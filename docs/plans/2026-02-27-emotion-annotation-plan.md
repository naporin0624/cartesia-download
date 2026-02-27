# Emotion Annotation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add LLM-based emotion annotation to the CLI, automatically inserting Cartesia SSML tags (`<emotion>`, `<speed>`, `<volume>`) into input text before TTS generation.

**Architecture:** TextAnnotator Strategy pattern with DI. A `TextAnnotator` interface defines a single `annotate(text) → string` method. A factory function creates provider-specific implementations (Claude first, extensible to OpenAI/Gemini). The annotator is injected into `runDownload` deps, running between text input and TTS generation.

**Tech Stack:** Vercel AI SDK (`ai` + `@ai-sdk/anthropic`), vitest for testing

---

### Task 1: Install dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install AI SDK packages**

Run:

```bash
pnpm add ai @ai-sdk/anthropic
```

**Step 2: Verify installation**

Run: `pnpm ls ai @ai-sdk/anthropic`
Expected: Both packages listed with versions

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat: add ai sdk and anthropic provider dependencies"
```

---

### Task 2: Add types to types.ts

**Files:**

- Modify: `src/types.ts`

**Step 1: Write the failing test**

No test file needed — these are type definitions. Verify with typecheck.

**Step 2: Add types**

Add to the end of `src/types.ts`:

```typescript
export type AnnotatorProvider = 'claude';

export interface TextAnnotator {
  annotate(text: string): Promise<string | CartesiaDownloadError>;
}
```

Add to `CartesiaDownloadError` union:

```typescript
| { type: 'AnnotationError'; cause: unknown }
| { type: 'UnsupportedProvider'; provider: string }
```

Add to `RawCliArgs`:

```typescript
provider?: string
'no-annotate'?: boolean
```

Add to `RcConfig`:

```typescript
provider?: string
noAnnotate?: boolean
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: No new errors

**Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat: add TextAnnotator interface and annotation error types"
```

---

### Task 3: Implement claude-annotator provider

**Files:**

- Create: `src/providers/claude-annotator.ts`
- Create: `src/providers/claude-annotator.test.ts`

**Step 1: Write the failing test**

Create `src/providers/claude-annotator.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createClaudeAnnotator } from './claude-annotator.js';
import type { CartesiaDownloadError } from '../types.js';

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

import { generateText } from 'ai';

const mockGenerateText = vi.mocked(generateText);

describe('createClaudeAnnotator', () => {
  it('returns SSML-annotated text from Claude', async () => {
    const annotatedText = '<emotion value="excited"/> こんにちは！ <emotion value="neutral"/> 今日はいい天気ですね。';
    mockGenerateText.mockResolvedValue({
      text: annotatedText,
    } as Awaited<ReturnType<typeof generateText>>);

    const annotator = createClaudeAnnotator();
    const result = await annotator.annotate('こんにちは！今日はいい天気ですね。');

    expect(result).toBe(annotatedText);
    expect(mockGenerateText).toHaveBeenCalledOnce();
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('SSML'),
        prompt: 'こんにちは！今日はいい天気ですね。',
      }),
    );
  });

  it('returns AnnotationError when generateText throws', async () => {
    const apiError = new Error('API key invalid');
    mockGenerateText.mockRejectedValue(apiError);

    const annotator = createClaudeAnnotator();
    const result = await annotator.annotate('テスト');

    const error = result as CartesiaDownloadError;
    expect(error.type).toBe('AnnotationError');
    expect((error as { type: 'AnnotationError'; cause: unknown }).cause).toBe(apiError);
  });

  it('returns original text when Claude returns empty string', async () => {
    mockGenerateText.mockResolvedValue({
      text: '',
    } as Awaited<ReturnType<typeof generateText>>);

    const annotator = createClaudeAnnotator();
    const result = await annotator.annotate('元のテキスト');

    expect(result).toBe('元のテキスト');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- src/providers/claude-annotator.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `src/providers/claude-annotator.ts`:

```typescript
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { TextAnnotator, CartesiaDownloadError } from '../types.js';

const SYSTEM_PROMPT = `You are a speech emotion annotator for the Cartesia TTS engine.

Your task: Insert Cartesia SSML tags into the input text to add natural prosody (emotion, speed, volume).

Available SSML tags:
- <emotion value="..."/> — Emotions: neutral, angry, excited, content, sad, scared, happy, curious, sarcastic, hesitant, confident, calm, surprised
- <speed ratio="..."/> — Speed multiplier: 0.6 to 1.5 (1.0 = default)
- <volume ratio="..."/> — Volume multiplier: 0.5 to 2.0 (1.0 = default)

Rules:
1. Analyze each sentence for its emotional tone, appropriate speed, and volume
2. Insert SSML tags BEFORE the sentence or phrase they apply to
3. Do NOT modify the original text content — only insert tags
4. Do NOT add any explanation, markdown, or wrapping — output ONLY the annotated text
5. Use emotion tags liberally but speed/volume tags sparingly (only when clearly needed)
6. If the text is already neutral with no clear emotional variation, still add <emotion value="neutral"/> at the start

Example input:
やったー！テストに合格した！でも、次の試験が心配だな…

Example output:
<emotion value="excited"/> <speed ratio="1.2"/> やったー！テストに合格した！ <emotion value="anxious"/> <speed ratio="0.9"/> でも、次の試験が心配だな…`;

export function createClaudeAnnotator(): TextAnnotator {
  return {
    async annotate(text: string): Promise<string | CartesiaDownloadError> {
      try {
        const { text: annotatedText } = await generateText({
          model: anthropic('claude-sonnet-4-20250514'),
          system: SYSTEM_PROMPT,
          prompt: text,
        });

        return annotatedText || text;
      } catch (cause) {
        return { type: 'AnnotationError', cause };
      }
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- src/providers/claude-annotator.test.ts`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/providers/claude-annotator.ts src/providers/claude-annotator.test.ts
git commit -m "feat: implement Claude annotator with AI SDK"
```

---

### Task 4: Implement annotator factory

**Files:**

- Create: `src/core/annotator.ts`
- Create: `src/core/annotator.test.ts`

**Step 1: Write the failing test**

Create `src/core/annotator.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createAnnotator } from './annotator.js';
import type { CartesiaDownloadError } from '../types.js';

vi.mock('../providers/claude-annotator.js', () => ({
  createClaudeAnnotator: vi.fn(() => ({
    annotate: vi.fn().mockResolvedValue('annotated text'),
  })),
}));

describe('createAnnotator', () => {
  it('returns a Claude annotator for provider "claude"', () => {
    const result = createAnnotator('claude');
    expect(result).not.toHaveProperty('type');
    expect(result).toHaveProperty('annotate');
  });

  it('returns UnsupportedProvider error for unknown provider', () => {
    const result = createAnnotator('unknown-provider');
    const error = result as CartesiaDownloadError;
    expect(error).toEqual({ type: 'UnsupportedProvider', provider: 'unknown-provider' });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- src/core/annotator.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `src/core/annotator.ts`:

```typescript
import type { TextAnnotator, CartesiaDownloadError } from '../types.js';
import { createClaudeAnnotator } from '../providers/claude-annotator.js';

export function createAnnotator(provider: string): TextAnnotator | CartesiaDownloadError {
  switch (provider) {
    case 'claude':
      return createClaudeAnnotator();
    default:
      return { type: 'UnsupportedProvider', provider };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- src/core/annotator.test.ts`
Expected: 2 tests PASS

**Step 5: Commit**

```bash
git add src/core/annotator.ts src/core/annotator.test.ts
git commit -m "feat: add annotator factory with strategy pattern"
```

---

### Task 5: Integrate annotator into download command

**Files:**

- Modify: `src/commands/download.ts`
- Modify: `src/commands/download.test.ts`

**Step 1: Write failing tests**

Add to `src/commands/download.test.ts` — new tests for annotation behavior:

```typescript
// Add to imports:
import type { TextAnnotator } from '../types.js';

// Add mock helper:
function createMockAnnotator(result: string | CartesiaDownloadError): TextAnnotator {
  return { annotate: vi.fn().mockResolvedValue(result) };
}

// Add to createMockDeps overrides type and function:
// annotator?: TextAnnotator
// annotator: overrides?.annotator,

// New test cases:

it('annotates text before TTS generation when annotator is provided', async () => {
  const ttsResult: TtsResult = { audioData, format: 'wav' };
  const ttsClient = createMockTtsClient(ttsResult);
  const annotator = createMockAnnotator('<emotion value="excited"/> hello');

  const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: 'out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, annotator }));

  expect(result).toBeUndefined();
  expect(annotator.annotate).toHaveBeenCalledWith('hello');
  const config = (ttsClient.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
  expect(config.text).toBe('<emotion value="excited"/> hello');
});

it('skips annotation when no-annotate is true', async () => {
  const ttsResult: TtsResult = { audioData, format: 'wav' };
  const ttsClient = createMockTtsClient(ttsResult);
  const annotator = createMockAnnotator('should not be called');

  const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: 'out.wav', 'no-annotate': true }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, annotator }));

  expect(result).toBeUndefined();
  expect(annotator.annotate).not.toHaveBeenCalled();
  const config = (ttsClient.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
  expect(config.text).toBe('hello');
});

it('returns error when annotation fails', async () => {
  const annotationError: CartesiaDownloadError = { type: 'AnnotationError', cause: new Error('LLM down') };
  const annotator = createMockAnnotator(annotationError as unknown as string);
  // Fix: the mock should return the error object
  (annotator.annotate as ReturnType<typeof vi.fn>).mockResolvedValue(annotationError);

  const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: 'out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ annotator }));

  expect(result).toEqual(annotationError);
});

it('proceeds without annotation when annotator is not provided', async () => {
  const ttsResult: TtsResult = { audioData, format: 'wav' };
  const ttsClient = createMockTtsClient(ttsResult);

  const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: 'out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient }));

  expect(result).toBeUndefined();
  const config = (ttsClient.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
  expect(config.text).toBe('hello');
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/commands/download.test.ts`
Expected: New tests FAIL (annotator not in deps yet)

**Step 3: Modify download.ts**

Changes to `src/commands/download.ts`:

1. Add `TextAnnotator` to imports from `../types.js`
2. Add `annotator?: TextAnnotator` to `deps` parameter of `runDownload`
3. Add `'no-annotate'?: boolean` handling — read from `args`
4. After text resolution and config resolution, before `ttsClient.generate`:

```typescript
// Annotate text if annotator is provided and not skipped
if (deps.annotator && !args['no-annotate']) {
  const annotated = await deps.annotator.annotate(config.text);
  if (isError(annotated)) {
    return annotated;
  }
  config = { ...config, text: annotated };
}
```

5. Add CLI flag definitions:

```typescript
provider: {
  type: 'string',
  default: 'claude',
  description: 'LLM provider for emotion annotation (claude)',
},
'no-annotate': {
  type: 'boolean',
  default: false,
  description: 'Skip emotion annotation',
},
```

6. In the `run` handler, add annotator creation:

```typescript
import { createAnnotator } from '../core/annotator.js';

// In run handler, before calling runDownload:
const noAnnotate = ctx.values['no-annotate'];
let annotator: TextAnnotator | undefined;
if (!noAnnotate) {
  const annotatorResult = createAnnotator(ctx.values.provider ?? 'claude');
  if (isError(annotatorResult)) {
    console.error(`Error: ${annotatorResult.type}`);
    process.exit(1);
  }
  annotator = annotatorResult;
}
```

Pass `annotator` into `runDownload` deps.

**Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/commands/download.test.ts`
Expected: ALL tests PASS (old + new)

**Step 5: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 6: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 7: Commit**

```bash
git add src/commands/download.ts src/commands/download.test.ts
git commit -m "feat: integrate emotion annotation into download command"
```

---

### Task 6: Update .env.example and docs

**Files:**

- Modify: `.env.example` (if exists, otherwise create)

**Step 1: Add ANTHROPIC_API_KEY to .env.example**

Add:

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

The AI SDK `@ai-sdk/anthropic` reads `ANTHROPIC_API_KEY` from environment automatically.

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add ANTHROPIC_API_KEY to env example"
```

---

### Task 7: Full validation

**Step 1: Run all tests**

Run: `pnpm test`
Expected: All pass

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Run lint**

Run: `pnpm lint`
Expected: No errors (or only pre-existing ones)

**Step 4: Build**

Run: `pnpm build`
Expected: Successful build

**Step 5: Manual E2E test (optional, requires API keys)**

```bash
CARTESIA_API_KEY=xxx ANTHROPIC_API_KEY=xxx pnpm dev -- \
  --text "やったー！テストに合格した！でも、次の試験が心配だな…" \
  --voice-id YOUR_VOICE_ID \
  --output test-emotion.wav
```

Verify the output audio has emotional variation.

```bash
# Compare without annotation:
CARTESIA_API_KEY=xxx pnpm dev -- \
  --text "やったー！テストに合格した！でも、次の試験が心配だな…" \
  --voice-id YOUR_VOICE_ID \
  --output test-plain.wav \
  --no-annotate
```
