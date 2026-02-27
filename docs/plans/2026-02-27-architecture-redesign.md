# Architecture Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the codebase to separate error types by module, split DI into IO/Services layers, decouple annotation side-effects, thin out the CLI boundary, and add user-friendly error formatting.

**Architecture:** Module-scoped error types (`ConfigError`, `TtsError`, `IOError`, `AnnotationError`) replace the flat `CartesiaDownloadError` union. A new `src/core/io.ts` module encapsulates all file I/O behind a single `IO` interface. The annotation pipeline separates text transformation from file writing. The CLI handler becomes a thin adapter that only assembles deps and calls `match()`.

**Tech Stack:** TypeScript, neverthrow (Result/ResultAsync), vitest, gunshi, oxlint/oxfmt

---

## Scope

Changes from the brainstorming discussion, **excluding** streaming support (separate future task). Six areas:

1. Error types modularization
2. IO layer extraction
3. Annotation transform/effect separation
4. CLI thinning + formatError
5. readRcFile Result化
6. Cleanup: remove fromResult helper, unused imports

---

### Task 1: Define module-scoped error types in `src/types.ts`

**Files:**

- Modify: `src/types.ts`
- Test: (type-only change — verified by `pnpm typecheck` in later tasks)

**Step 1: Replace the flat CartesiaDownloadError union with module-scoped types**

Replace the entire `src/types.ts` with:

```typescript
import type { Result, ResultAsync } from 'neverthrow';

export type AudioFormat = 'wav' | 'mp3';

export interface ResolvedConfig {
  apiKey: string;
  voiceId: string;
  model: string;
  sampleRate: number;
  format: AudioFormat;
  outputPath: string;
  text: string;
}

export interface RawCliArgs {
  input?: string;
  text?: string;
  'voice-id'?: string;
  format?: string;
  output?: string;
  model?: string;
  'sample-rate'?: number;
  provider?: string;
  'provider-model'?: string;
  'provider-api-key'?: string;
  'no-annotate'?: boolean;
}

export interface RcConfig {
  apiKey?: string;
  voiceId?: string;
  model?: string;
  sampleRate?: number;
  format?: string;
  outputPath?: string;
  provider?: string;
  providerModel?: string;
  providerApiKey?: string;
  noAnnotate?: boolean;
}

export interface TtsResult {
  audioData: ArrayBuffer;
  format: AudioFormat;
}

// --- Module-scoped error types ---

export type ConfigError = { type: 'MissingApiKey' } | { type: 'MissingVoiceId' } | { type: 'MissingText' } | { type: 'MissingOutput' } | { type: 'InvalidFormat'; value: string };

export type IOError = { type: 'FileReadError'; path: string; cause: unknown } | { type: 'FileWriteError'; path: string; cause: unknown };

export type TtsError = { type: 'TtsApiError'; cause: unknown };

export type AnnotationError = { type: 'AnnotationError'; cause: unknown } | { type: 'UnsupportedProvider'; provider: string };

// App-level union for CLI boundary
export type AppError = ConfigError | IOError | TtsError | AnnotationError;

// --- Interfaces with module-scoped errors ---

export interface TtsClient {
  generate(config: ResolvedConfig): ResultAsync<TtsResult, TtsError>;
}

export interface FileOutput {
  write(path: string, result: TtsResult): ResultAsync<void, IOError>;
}

export type AnnotatorProvider = 'claude';

export interface TextAnnotator {
  annotate(text: string): ResultAsync<string, AnnotationError>;
}

// --- IO interface ---

export interface IO {
  readTextFile(path: string): ResultAsync<string, IOError>;
  readRcFile(path: string): ResultAsync<RcConfig, never>;
  writeFile(path: string, data: Buffer | string): ResultAsync<void, IOError>;
}
```

**Step 2: Run typecheck to see what breaks**

Run: `pnpm typecheck 2>&1 | head -80`
Expected: Type errors across all modules referencing `CartesiaDownloadError`. This is expected — we fix them in subsequent tasks.

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "refactor: split CartesiaDownloadError into module-scoped error types"
```

---

### Task 2: Create `src/core/io.ts` + `src/core/io.test.ts`

**Files:**

- Create: `src/core/io.ts`
- Create: `src/core/io.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/core/io.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises');

import fs from 'node:fs/promises';
import { createIO } from './io.js';

const mockedFs = vi.mocked(fs);

describe('createIO', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('readTextFile', () => {
    it('returns file content for existing file', async () => {
      mockedFs.readFile.mockResolvedValue('text content');
      const io = createIO();
      const result = await io.readTextFile('/path/to/file.txt');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBe('text content');
      expect(mockedFs.readFile).toHaveBeenCalledWith('/path/to/file.txt', 'utf-8');
    });

    it('returns FileReadError when file does not exist', async () => {
      const cause = new Error('ENOENT');
      mockedFs.readFile.mockRejectedValue(cause);
      const io = createIO();
      const result = await io.readTextFile('/missing.txt');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toEqual({ type: 'FileReadError', path: '/missing.txt', cause });
    });
  });

  describe('readRcFile', () => {
    it('returns parsed config from existing file', async () => {
      mockedFs.readFile.mockResolvedValue('{"apiKey":"key","voiceId":"v1"}');
      const io = createIO();
      const result = await io.readRcFile('/path/.cartesiarc.json');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({ apiKey: 'key', voiceId: 'v1' });
    });

    it('returns empty object when file does not exist', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('ENOENT'));
      const io = createIO();
      const result = await io.readRcFile('/missing.json');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({});
    });
  });

  describe('writeFile', () => {
    it('writes data to specified path', async () => {
      mockedFs.writeFile.mockResolvedValue(undefined);
      const io = createIO();
      const result = await io.writeFile('/out.txt', 'content');
      expect(result.isOk()).toBe(true);
      expect(mockedFs.writeFile).toHaveBeenCalledWith('/out.txt', 'content');
    });

    it('returns FileWriteError on failure', async () => {
      const cause = new Error('disk full');
      mockedFs.writeFile.mockRejectedValue(cause);
      const io = createIO();
      const result = await io.writeFile('/fail.txt', 'x');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toEqual({ type: 'FileWriteError', path: '/fail.txt', cause });
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/io.test.ts`
Expected: FAIL — `createIO` does not exist yet.

**Step 3: Write minimal implementation**

```typescript
// src/core/io.ts
import fs from 'node:fs/promises';
import { ResultAsync, okAsync } from 'neverthrow';
import type { IO, IOError, RcConfig } from '../types.js';

export const createIO = (): IO => ({
  readTextFile(path: string): ResultAsync<string, IOError> {
    return ResultAsync.fromPromise(fs.readFile(path, 'utf-8'), (cause): IOError => ({ type: 'FileReadError', path, cause }));
  },

  readRcFile(path: string): ResultAsync<RcConfig, never> {
    return ResultAsync.fromPromise(
      (async () => {
        const content = await fs.readFile(path, 'utf-8');
        return JSON.parse(content) as RcConfig;
      })(),
      () => ({}) as never,
    ).orElse(() => okAsync({}));
  },

  writeFile(path: string, data: Buffer | string): ResultAsync<void, IOError> {
    return ResultAsync.fromPromise(fs.writeFile(path, data), (cause): IOError => ({ type: 'FileWriteError', path, cause }));
  },
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/io.test.ts`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add src/core/io.ts src/core/io.test.ts
git commit -m "feat: add IO interface with createIO factory"
```

---

### Task 3: Update `src/core/config.ts` + test to use module-scoped errors

**Files:**

- Modify: `src/core/config.ts`
- Modify: `src/core/config.test.ts`

**Step 1: Update config.ts**

Key changes:

- Import `ConfigError` instead of `CartesiaDownloadError`
- `parseFormat` returns `Result<AudioFormat, ConfigError>`
- `resolveConfig` returns `Result<ResolvedConfig, ConfigError>`
- Remove `readTextFile` and `readRcFile` (moved to `io.ts`)

```typescript
// src/core/config.ts
import { ok, err, type Result } from 'neverthrow';
import type { AudioFormat, ConfigError, RawCliArgs, RcConfig, ResolvedConfig } from '../types.js';

export const parseFormat = (value: string): Result<AudioFormat, ConfigError> => {
  const lower = value.toLowerCase();
  if (lower === 'wav' || lower === 'mp3') {
    return ok(lower);
  }
  return err({ type: 'InvalidFormat', value });
};

export const resolveConfig = (args: RawCliArgs, env: Record<string, string | undefined>, rc: RcConfig): Result<ResolvedConfig, ConfigError> => {
  const apiKey = env['CARTESIA_API_KEY'] ?? rc.apiKey;
  if (!apiKey) {
    return err({ type: 'MissingApiKey' });
  }

  const voiceId = args['voice-id'] ?? env['CARTESIA_VOICE_ID'] ?? rc.voiceId;
  if (!voiceId) {
    return err({ type: 'MissingVoiceId' });
  }

  const text = args.text;
  if (!text) {
    return err({ type: 'MissingText' });
  }

  const outputPath = args.output ?? rc.outputPath;
  if (!outputPath) {
    return err({ type: 'MissingOutput' });
  }

  const rawFormat = args.format ?? rc.format ?? 'wav';

  return parseFormat(rawFormat).map((format) => {
    const model = args.model ?? rc.model ?? 'sonic-3';
    const sampleRate = args['sample-rate'] ?? rc.sampleRate ?? 44100;
    return { apiKey, voiceId, model, sampleRate, format, outputPath, text };
  });
};
```

**Step 2: Update config.test.ts**

Key changes:

- Remove `readRcFile` and `readTextFile` tests (moved to io.test.ts)
- Remove `vi.mock('node:fs/promises')` and `fs` import
- Remove `beforeEach` block
- All `parseFormat` and `resolveConfig` tests stay unchanged (they already use `isOk/isErr`)

```typescript
// src/core/config.test.ts
import { describe, it, expect } from 'vitest';
import type { RawCliArgs, RcConfig } from '../types.js';
import { parseFormat, resolveConfig } from './config.js';

// parseFormat tests — unchanged from current
// resolveConfig tests — unchanged from current
// NO readRcFile/readTextFile tests (moved to io.test.ts)
```

**Step 3: Run tests**

Run: `pnpm vitest run src/core/config.test.ts`
Expected: PASS (16 tests — 6 parseFormat + 10 resolveConfig)

**Step 4: Commit**

```bash
git add src/core/config.ts src/core/config.test.ts
git commit -m "refactor: config uses ConfigError, remove IO functions"
```

---

### Task 4: Update `src/core/output.ts` + test to use IOError

**Files:**

- Modify: `src/core/output.ts`
- Modify: `src/core/output.test.ts`

**Step 1: Update output.ts**

```typescript
// src/core/output.ts
import fs from 'node:fs/promises';
import { ResultAsync } from 'neverthrow';
import type { FileOutput, IOError, TtsResult } from '../types.js';

export const createFileOutput = (): FileOutput => ({
  write(path: string, result: TtsResult): ResultAsync<void, IOError> {
    return ResultAsync.fromPromise(fs.writeFile(path, Buffer.from(result.audioData)), (cause): IOError => ({ type: 'FileWriteError', path, cause }));
  },
});
```

**Step 2: Update output.test.ts — assertions unchanged, only import types change**

Replace `CartesiaDownloadError` references with `IOError` in type annotations if any. Current tests use inline objects so no real change needed — just verify they still pass.

**Step 3: Run tests**

Run: `pnpm vitest run src/core/output.test.ts`
Expected: PASS (2 tests)

**Step 4: Commit**

```bash
git add src/core/output.ts src/core/output.test.ts
git commit -m "refactor: output uses IOError instead of CartesiaDownloadError"
```

---

### Task 5: Update `src/core/tts-client.ts` + test to use TtsError

**Files:**

- Modify: `src/core/tts-client.ts`
- Modify: `src/core/tts-client.test.ts`

**Step 1: Update tts-client.ts**

Change import from `CartesiaDownloadError` to `TtsError`. Change the error mapper:

```typescript
(cause): TtsError => ({ type: 'TtsApiError', cause });
```

`generate` return type becomes `ResultAsync<TtsResult, TtsError>`.

**Step 2: Update tts-client.test.ts**

Replace `CartesiaDownloadError` type casts with `TtsError`:

```typescript
const error = result._unsafeUnwrapErr();
expect(error.type).toBe('TtsApiError');
expect(error.cause).toBe(apiError); // TtsError always has cause
```

**Step 3: Run tests**

Run: `pnpm vitest run src/core/tts-client.test.ts`
Expected: PASS (8 tests)

**Step 4: Commit**

```bash
git add src/core/tts-client.ts src/core/tts-client.test.ts
git commit -m "refactor: tts-client uses TtsError instead of CartesiaDownloadError"
```

---

### Task 6: Update `src/providers/claude-annotator.ts` + test to use AnnotationError

**Files:**

- Modify: `src/providers/claude-annotator.ts`
- Modify: `src/providers/claude-annotator.test.ts`

**Step 1: Update claude-annotator.ts**

Change import from `CartesiaDownloadError` to `AnnotationError`. Change error mapper:

```typescript
(cause): AnnotationError => ({ type: 'AnnotationError', cause });
```

`annotate` return type becomes `ResultAsync<string, AnnotationError>`.

**Step 2: Update claude-annotator.test.ts**

Replace `CartesiaDownloadError` references with `AnnotationError`.

**Step 3: Run tests**

Run: `pnpm vitest run src/providers/claude-annotator.test.ts`
Expected: PASS (3 tests)

**Step 4: Commit**

```bash
git add src/providers/claude-annotator.ts src/providers/claude-annotator.test.ts
git commit -m "refactor: claude-annotator uses AnnotationError"
```

---

### Task 7: Update `src/core/annotator.ts` + test to use AnnotationError

**Files:**

- Modify: `src/core/annotator.ts`
- Modify: `src/core/annotator.test.ts`

**Step 1: Update annotator.ts**

```typescript
import { ok, err, type Result } from 'neverthrow';
import type { TextAnnotator, AnnotationError } from '../types.js';
import { createClaudeAnnotator } from '../providers/claude-annotator.js';

type AnnotatorOptions = {
  apiKey?: string;
  model?: string;
};

export const createAnnotator = (provider: string, options?: AnnotatorOptions): Result<TextAnnotator, AnnotationError> => {
  switch (provider) {
    case 'claude':
      return ok(createClaudeAnnotator(options));
    default:
      return err({ type: 'UnsupportedProvider', provider });
  }
};
```

**Step 2: Update annotator.test.ts — no assertion changes needed**

**Step 3: Run tests**

Run: `pnpm vitest run src/core/annotator.test.ts`
Expected: PASS (2 tests)

**Step 4: Commit**

```bash
git add src/core/annotator.ts src/core/annotator.test.ts
git commit -m "refactor: annotator uses AnnotationError"
```

---

### Task 8: Add `formatError` utility in `src/core/format-error.ts` + test

**Files:**

- Create: `src/core/format-error.ts`
- Create: `src/core/format-error.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/core/format-error.test.ts
import { describe, it, expect } from 'vitest';
import { formatError } from './format-error.js';
import type { AppError } from '../types.js';

describe('formatError', () => {
  it('formats MissingApiKey', () => {
    expect(formatError({ type: 'MissingApiKey' })).toBe('API key is required. Set CARTESIA_API_KEY environment variable or add apiKey to .cartesiarc.json.');
  });

  it('formats MissingVoiceId', () => {
    expect(formatError({ type: 'MissingVoiceId' })).toBe('Voice ID is required. Use --voice-id flag or set CARTESIA_VOICE_ID environment variable.');
  });

  it('formats MissingText', () => {
    expect(formatError({ type: 'MissingText' })).toBe('Text is required. Use --text flag or --input to read from a file.');
  });

  it('formats MissingOutput', () => {
    expect(formatError({ type: 'MissingOutput' })).toBe('Output path is required. Use --output flag.');
  });

  it('formats InvalidFormat', () => {
    expect(formatError({ type: 'InvalidFormat', value: 'ogg' })).toBe('Unsupported audio format "ogg". Supported formats: wav, mp3.');
  });

  it('formats FileReadError', () => {
    expect(formatError({ type: 'FileReadError', path: '/tmp/x.txt', cause: new Error('ENOENT') })).toBe('Failed to read file: /tmp/x.txt');
  });

  it('formats FileWriteError', () => {
    expect(formatError({ type: 'FileWriteError', path: '/tmp/out.wav', cause: new Error('disk full') })).toBe('Failed to write file: /tmp/out.wav');
  });

  it('formats TtsApiError', () => {
    expect(formatError({ type: 'TtsApiError', cause: new Error('timeout') })).toBe('Cartesia TTS API error: timeout');
  });

  it('formats TtsApiError with non-Error cause', () => {
    expect(formatError({ type: 'TtsApiError', cause: 'unknown' })).toBe('Cartesia TTS API error: unknown');
  });

  it('formats AnnotationError', () => {
    expect(formatError({ type: 'AnnotationError', cause: new Error('rate limit') })).toBe('Emotion annotation failed: rate limit');
  });

  it('formats UnsupportedProvider', () => {
    expect(formatError({ type: 'UnsupportedProvider', provider: 'openai' })).toBe('Unsupported annotation provider "openai". Supported: claude.');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/format-error.test.ts`
Expected: FAIL — module not found.

**Step 3: Write minimal implementation**

```typescript
// src/core/format-error.ts
import type { AppError } from '../types.js';

const causeMessage = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

export const formatError = (error: AppError): string => {
  switch (error.type) {
    case 'MissingApiKey':
      return 'API key is required. Set CARTESIA_API_KEY environment variable or add apiKey to .cartesiarc.json.';
    case 'MissingVoiceId':
      return 'Voice ID is required. Use --voice-id flag or set CARTESIA_VOICE_ID environment variable.';
    case 'MissingText':
      return 'Text is required. Use --text flag or --input to read from a file.';
    case 'MissingOutput':
      return 'Output path is required. Use --output flag.';
    case 'InvalidFormat':
      return `Unsupported audio format "${error.value}". Supported formats: wav, mp3.`;
    case 'FileReadError':
      return `Failed to read file: ${error.path}`;
    case 'FileWriteError':
      return `Failed to write file: ${error.path}`;
    case 'TtsApiError':
      return `Cartesia TTS API error: ${causeMessage(error.cause)}`;
    case 'AnnotationError':
      return `Emotion annotation failed: ${causeMessage(error.cause)}`;
    case 'UnsupportedProvider':
      return `Unsupported annotation provider "${error.provider}". Supported: claude.`;
  }
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/format-error.test.ts`
Expected: PASS (11 tests)

**Step 5: Commit**

```bash
git add src/core/format-error.ts src/core/format-error.test.ts
git commit -m "feat: add formatError for user-friendly error messages"
```

---

### Task 9: Rewrite `src/commands/download.ts` + test — IO injection, annotation separation, thin CLI

This is the largest task. Key changes:

1. `DownloadDeps` → use `IO` interface instead of individual functions
2. `annotateText` only transforms text, does not write files
3. Pipeline writes audio + annotation txt as separate effects
4. `downloadCommand.run` becomes thin: assemble deps → `runDownload()` → `match(ok, formatError)`
5. Remove `fromResult` helper (use neverthrow's built-in `ResultAsync` lifting)

**Files:**

- Modify: `src/commands/download.ts`
- Modify: `src/commands/download.test.ts`

**Step 1: Rewrite download.ts**

```typescript
// src/commands/download.ts
import path from 'node:path';
import { define } from 'gunshi';
import { okAsync, errAsync, ResultAsync } from 'neverthrow';
import type { AppError, FileOutput, IO, RawCliArgs, RcConfig, ResolvedConfig, TextAnnotator, TtsClient } from '../types.js';
import { resolveConfig } from '../core/config.js';
import { createCartesiaTtsClient, type CartesiaLikeClient } from '../core/tts-client.js';
import { createFileOutput } from '../core/output.js';
import { createIO } from '../core/io.js';
import { CartesiaClient } from '@cartesia/cartesia-js';
import { createAnnotator } from '../core/annotator.js';
import { formatError } from '../core/format-error.js';

type DownloadDeps = {
  io: IO;
  ttsClient?: TtsClient;
  fileOutput?: FileOutput;
  annotator?: TextAnnotator;
  createTtsClient?: (apiKey: string) => TtsClient;
};

const resolveText = (args: RawCliArgs, io: IO): ResultAsync<RawCliArgs, AppError> => {
  if (args.input && !args.text) {
    return io.readTextFile(args.input).map((text) => ({ ...args, text }));
  }
  return okAsync(args);
};

const annotateText = (config: ResolvedConfig, args: RawCliArgs, annotator?: TextAnnotator): ResultAsync<ResolvedConfig, AppError> => {
  if (annotator && !args['no-annotate']) {
    return annotator.annotate(config.text).map((annotated) => ({ ...config, text: annotated }));
  }
  return okAsync(config);
};

const writeAnnotationFile = (config: ResolvedConfig, originalText: string, io: IO): ResultAsync<void, AppError> => {
  if (config.text !== originalText) {
    const parsed = path.parse(config.outputPath);
    const txtPath = path.join(parsed.dir, `${parsed.name}.txt`);
    return io.writeFile(txtPath, config.text);
  }
  return okAsync(undefined);
};

export const runDownload = (args: RawCliArgs, env: Record<string, string | undefined>, deps: DownloadDeps): ResultAsync<void, AppError> =>
  resolveText(args, deps.io)
    .andThen((resolvedArgs) =>
      deps.io.readRcFile('.cartesiarc.json').andThen((rc) => {
        const configResult = resolveConfig(resolvedArgs, env, rc);
        return configResult.isOk() ? okAsync(configResult.value) : errAsync(configResult.error);
      }),
    )
    .andThen((config) => {
      const originalText = config.text;
      return annotateText(config, args, deps.annotator).andThen((annotatedConfig) => writeAnnotationFile(annotatedConfig, originalText, deps.io).map(() => annotatedConfig));
    })
    .andThen((config) => {
      const ttsClient = deps.ttsClient ?? deps.createTtsClient!(config.apiKey);
      const fileOutput = deps.fileOutput ?? createFileOutput();
      return ttsClient.generate(config).andThen((result) => fileOutput.write(config.outputPath, result));
    });

export const downloadCommand = define({
  name: 'download',
  description: 'Generate audio from text using Cartesia TTS API',
  args: {
    input: { type: 'string', short: 'i', description: 'Path to text file' },
    text: { type: 'string', short: 't', description: 'Text to synthesize' },
    'voice-id': { type: 'string', description: 'Cartesia voice ID' },
    format: { type: 'string', short: 'f', default: 'wav', description: 'Output format (wav or mp3)' },
    output: { type: 'string', short: 'o', description: 'Output file path' },
    model: { type: 'string', short: 'm', default: 'sonic-3', description: 'Model ID' },
    'sample-rate': { type: 'number', default: 44100, description: 'Sample rate' },
    provider: { type: 'string', default: 'claude', description: 'LLM provider for emotion annotation (claude)' },
    'provider-model': { type: 'string', description: 'LLM model for emotion annotation (e.g. claude-sonnet-4-20250514)' },
    'provider-api-key': { type: 'string', description: 'API key for the LLM provider' },
    'no-annotate': { type: 'boolean', default: false, description: 'Skip emotion annotation' },
  },
  examples: `
# Generate WAV from text
$ cartesia-download --text "こんにちは" --voice-id xxx --output hello.wav

# Generate MP3 from file
$ cartesia-download --input script.txt --voice-id xxx --format mp3 --output hello.mp3
`,
  run: async (ctx) => {
    const args: RawCliArgs = {
      input: ctx.values.input,
      text: ctx.values.text,
      'voice-id': ctx.values['voice-id'],
      format: ctx.values.format,
      output: ctx.values.output,
      model: ctx.values.model,
      'sample-rate': ctx.values['sample-rate'],
      provider: ctx.values.provider,
      'provider-model': ctx.values['provider-model'],
      'provider-api-key': ctx.values['provider-api-key'],
      'no-annotate': ctx.values['no-annotate'],
    };

    const io = createIO();
    const rc = await io.readRcFile('.cartesiarc.json');
    const rcConfig = rc._unsafeUnwrap();

    const annotator: TextAnnotator | undefined = (() => {
      if (ctx.values['no-annotate']) {
        return undefined;
      }
      const provider = ctx.values.provider ?? rcConfig.provider ?? 'claude';
      const providerApiKey = ctx.values['provider-api-key'] ?? rcConfig.providerApiKey;
      const providerModel = ctx.values['provider-model'] ?? rcConfig.providerModel;
      const result = createAnnotator(provider, { apiKey: providerApiKey, model: providerModel });
      if (result.isErr()) {
        console.error(formatError(result.error));
        process.exit(1);
      }
      return result.value;
    })();

    await runDownload(args, process.env, {
      io,
      annotator,
      createTtsClient: (apiKey) => {
        const client = new CartesiaClient({ apiKey });
        return createCartesiaTtsClient(client as unknown as CartesiaLikeClient);
      },
    }).match(
      () => {
        console.log('Audio saved successfully');
      },
      (error) => {
        console.error(formatError(error));
        process.exit(1);
      },
    );
  },
});
```

**Step 2: Rewrite download.test.ts**

Key changes:

- Mock deps use `IO` interface instead of separate `readTextFile`/`readRcFile`/`writeTextFile`
- `createMockIO` helper creates a mock IO object
- All test assertions stay at `isOk()`/`isErr()` level

```typescript
// src/commands/download.test.ts
import { describe, it, expect, vi } from 'vitest';
import { okAsync, errAsync, ResultAsync } from 'neverthrow';
import { runDownload } from './download.js';
import type { TtsClient, FileOutput, TtsResult, TextAnnotator, IO, AppError, IOError, TtsError, AnnotationError } from '../types.js';

const createMockTtsClient = (result: TtsResult | TtsError): TtsClient => ({
  generate: vi.fn().mockReturnValue('audioData' in result ? okAsync(result) : errAsync(result)),
});

const createMockFileOutput = (error?: IOError): FileOutput => ({
  write: vi.fn().mockReturnValue(error ? errAsync(error) : okAsync(undefined)),
});

const createMockAnnotator = (result: string | AnnotationError): TextAnnotator => ({
  annotate: vi.fn().mockReturnValue(typeof result === 'string' ? okAsync(result) : errAsync(result)),
});

const createMockIO = (overrides?: Partial<IO>): IO => ({
  readTextFile: overrides?.readTextFile ?? vi.fn().mockReturnValue(okAsync('file content')),
  readRcFile: overrides?.readRcFile ?? vi.fn().mockReturnValue(okAsync({})),
  writeFile: overrides?.writeFile ?? vi.fn().mockReturnValue(okAsync(undefined)),
});

const audioData = new ArrayBuffer(16);

const createMockDeps = (overrides?: { ttsClient?: TtsClient; fileOutput?: FileOutput; io?: IO; annotator?: TextAnnotator }) => ({
  ttsClient: overrides?.ttsClient ?? createMockTtsClient({ audioData, format: 'wav' }),
  fileOutput: overrides?.fileOutput ?? createMockFileOutput(),
  io: overrides?.io ?? createMockIO(),
  annotator: overrides?.annotator,
});

describe('runDownload', () => {
  it('generates audio and writes to file with --text', async () => {
    const ttsResult: TtsResult = { audioData, format: 'wav' };
    const ttsClient = createMockTtsClient(ttsResult);
    const fileOutput = createMockFileOutput();

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: 'out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, fileOutput }));

    expect(result.isOk()).toBe(true);
    expect(ttsClient.generate).toHaveBeenCalledOnce();
    expect(fileOutput.write).toHaveBeenCalledWith('out.wav', ttsResult);
  });

  it('reads text from --input file', async () => {
    const ttsResult: TtsResult = { audioData, format: 'wav' };
    const ttsClient = createMockTtsClient(ttsResult);
    const fileOutput = createMockFileOutput();
    const io = createMockIO({ readTextFile: vi.fn().mockReturnValue(okAsync('file content')) });

    const result = await runDownload({ input: '/tmp/test-input.txt', 'voice-id': 'v1', output: 'out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, fileOutput, io }));

    expect(result.isOk()).toBe(true);
    expect(ttsClient.generate).toHaveBeenCalledOnce();
    const config = (ttsClient.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(config.text).toBe('file content');
  });

  it('returns error when --input file read fails', async () => {
    const ttsClient = createMockTtsClient({ audioData, format: 'wav' });
    const fileReadError: IOError = { type: 'FileReadError', path: '/tmp/missing.txt', cause: new Error('ENOENT') };
    const io = createMockIO({ readTextFile: vi.fn().mockReturnValue(errAsync(fileReadError)) });

    const result = await runDownload({ input: '/tmp/missing.txt', 'voice-id': 'v1', output: 'out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, io }));

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(fileReadError);
    expect(ttsClient.generate).not.toHaveBeenCalled();
  });

  it('returns error when config resolution fails (missing apiKey)', async () => {
    const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: 'out.wav' }, {}, createMockDeps());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({ type: 'MissingApiKey' });
  });

  it('returns error when TTS generation fails', async () => {
    const apiError: TtsError = { type: 'TtsApiError', cause: new Error('API down') };
    const ttsClient = createMockTtsClient(apiError);

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: 'out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient }));

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(apiError);
  });

  it('returns error when file write fails', async () => {
    const ttsResult: TtsResult = { audioData, format: 'wav' };
    const writeError: IOError = { type: 'FileWriteError', path: 'out.wav', cause: new Error('disk full') };
    const ttsClient = createMockTtsClient(ttsResult);
    const fileOutput = createMockFileOutput(writeError);

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: 'out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, fileOutput }));

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(writeError);
  });

  it('prefers --text over --input when both provided', async () => {
    const ttsResult: TtsResult = { audioData, format: 'wav' };
    const ttsClient = createMockTtsClient(ttsResult);
    const io = createMockIO();

    const result = await runDownload({ text: 'from cli', input: '/tmp/file.txt', 'voice-id': 'v1', output: 'out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, io }));

    expect(result.isOk()).toBe(true);
    expect(io.readTextFile).not.toHaveBeenCalled();
    const config = (ttsClient.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(config.text).toBe('from cli');
  });

  it('annotates text before TTS generation when annotator is provided', async () => {
    const ttsResult: TtsResult = { audioData, format: 'wav' };
    const ttsClient = createMockTtsClient(ttsResult);
    const annotator = createMockAnnotator('<emotion value="excited"/> hello');

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: 'out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, annotator }));

    expect(result.isOk()).toBe(true);
    expect(annotator.annotate).toHaveBeenCalledWith('hello');
    const config = (ttsClient.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(config.text).toBe('<emotion value="excited"/> hello');
  });

  it('writes annotation txt file when text is annotated', async () => {
    const ttsResult: TtsResult = { audioData, format: 'wav' };
    const ttsClient = createMockTtsClient(ttsResult);
    const annotator = createMockAnnotator('<emotion value="excited"/> hello');
    const io = createMockIO();

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: '/tmp/out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, annotator, io }));

    expect(result.isOk()).toBe(true);
    expect(io.writeFile).toHaveBeenCalledWith('/tmp/out.txt', '<emotion value="excited"/> hello');
  });

  it('does not write annotation txt when text is unchanged', async () => {
    const ttsResult: TtsResult = { audioData, format: 'wav' };
    const ttsClient = createMockTtsClient(ttsResult);
    const io = createMockIO();

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: '/tmp/out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, io }));

    expect(result.isOk()).toBe(true);
    expect(io.writeFile).not.toHaveBeenCalled();
  });

  it('skips annotation when no-annotate is true', async () => {
    const ttsResult: TtsResult = { audioData, format: 'wav' };
    const ttsClient = createMockTtsClient(ttsResult);
    const annotator = createMockAnnotator('should not be called');

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: 'out.wav', 'no-annotate': true }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, annotator }));

    expect(result.isOk()).toBe(true);
    expect(annotator.annotate).not.toHaveBeenCalled();
    const config = (ttsClient.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(config.text).toBe('hello');
  });

  it('returns error when annotation fails', async () => {
    const annotationError: AnnotationError = { type: 'AnnotationError', cause: new Error('LLM down') };
    const annotator = createMockAnnotator(annotationError);

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: 'out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ annotator }));

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(annotationError);
  });

  it('proceeds without annotation when annotator is not provided', async () => {
    const ttsResult: TtsResult = { audioData, format: 'wav' };
    const ttsClient = createMockTtsClient(ttsResult);

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: 'out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient }));

    expect(result.isOk()).toBe(true);
    const config = (ttsClient.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(config.text).toBe('hello');
  });
});
```

**Step 3: Run tests**

Run: `pnpm vitest run src/commands/download.test.ts`
Expected: PASS (13 tests — 11 existing + 2 new annotation file tests)

**Step 4: Commit**

```bash
git add src/commands/download.ts src/commands/download.test.ts
git commit -m "refactor: download uses IO interface, separated annotation, thin CLI with formatError"
```

---

### Task 10: Delete old `readTextFile`/`readRcFile` from config.ts + final cleanup

**Files:**

- Modify: `src/core/config.ts` (if not already cleaned in Task 3)
- Delete references to old functions in any remaining imports

**Step 1: Verify no imports of `readTextFile`/`readRcFile` from config.ts remain**

Run: `grep -rn "from.*config.js" src/ --include="*.ts" | grep -E "readTextFile|readRcFile"`
Expected: No matches (download.ts no longer imports them)

**Step 2: Run full verification**

```bash
pnpm typecheck && pnpm test && pnpm build && pnpm lint
```

Expected: All pass — 0 errors, 55+ tests green, build succeeds, lint clean.

**Step 3: Run CLI smoke test**

```bash
npx tsx src/cli.ts --text "こんにちは" --voice-id test --output /tmp/test.wav --no-annotate
```

Expected: `Error: TtsApiError` (no real API key) or `Cartesia TTS API error: ...` with the new `formatError`.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: final cleanup after architecture redesign"
```

---

## Verification Checklist

After all tasks:

| Check | Command                                                                 | Expected                      |
| ----- | ----------------------------------------------------------------------- | ----------------------------- |
| Types | `pnpm typecheck`                                                        | 0 errors                      |
| Tests | `pnpm test`                                                             | 55+ tests pass                |
| Build | `pnpm build`                                                            | dist/cli.mjs produced         |
| Lint  | `pnpm lint`                                                             | 0 errors, 0 warnings          |
| Smoke | `npx tsx src/cli.ts --text x --voice-id v --output o.wav --no-annotate` | `Cartesia TTS API error: ...` |
