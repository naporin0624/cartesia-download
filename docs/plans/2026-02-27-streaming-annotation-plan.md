# Streaming Annotation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace sentence-level batch annotation with full-text streaming annotation using Claude `streamText` + `[SEP]` markers, so TTS generates audio per natural speech unit as Claude streams.

**Architecture:** Claude receives full text, streams back SSML-annotated text with `[SEP]` markers at natural speech boundaries. A MarkerParser buffers the token stream and yields complete speech chunks. Each chunk is sent to TTS sequentially. `--no-annotate` sends full text as a single TTS request.

**Tech Stack:** Vercel AI SDK v6 (`streamText`), `@ai-sdk/anthropic`, neverthrow, vitest

---

### Task 1: Add `stream` method to `TextAnnotator` interface

**Files:**
- Modify: `src/types.ts:58-59`

**Step 1: Update interface**

Add `stream` method to `TextAnnotator`:

```typescript
export interface TextAnnotator {
  annotate(text: string): ResultAsync<string, AnnotationError>;
  stream(text: string): ResultAsync<AsyncIterable<string>, AnnotationError>;
}
```

**Step 2: Run typecheck to confirm expected failures**

Run: `pnpm typecheck`
Expected: FAIL — existing implementations of `TextAnnotator` don't implement `stream`

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add stream method to TextAnnotator interface"
```

---

### Task 2: Create MarkerParser utility

**Files:**
- Create: `src/core/marker-parser.ts`
- Create: `src/core/marker-parser.test.ts`

**Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { parseMarkerStream } from './marker-parser.js';

// eslint-disable-next-line func-style -- async generators require function* syntax
async function* toStream(...parts: string[]): AsyncIterable<string> {
  for (const part of parts) {
    yield part;
  }
}

const collect = async (stream: AsyncIterable<string>): Promise<string[]> => {
  const results: string[] = [];
  for await (const chunk of stream) {
    results.push(chunk);
  }
  return results;
};

describe('parseMarkerStream', () => {
  it('yields chunks split by [SEP] marker', async () => {
    const result = await collect(parseMarkerStream(toStream('hello[SEP]world')));
    expect(result).toEqual(['hello', 'world']);
  });

  it('handles [SEP] split across token boundaries', async () => {
    const result = await collect(parseMarkerStream(toStream('hello[S', 'EP]world')));
    expect(result).toEqual(['hello', 'world']);
  });

  it('handles [SEP] split across three tokens', async () => {
    const result = await collect(parseMarkerStream(toStream('hello[', 'SE', 'P]world')));
    expect(result).toEqual(['hello', 'world']);
  });

  it('flushes remaining buffer on stream end', async () => {
    const result = await collect(parseMarkerStream(toStream('hello[SEP]world')));
    expect(result).toEqual(['hello', 'world']);
  });

  it('returns single chunk when no markers present', async () => {
    const result = await collect(parseMarkerStream(toStream('no markers here')));
    expect(result).toEqual(['no markers here']);
  });

  it('handles multiple consecutive markers', async () => {
    const result = await collect(parseMarkerStream(toStream('a[SEP]b[SEP]c')));
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('skips empty chunks between markers', async () => {
    const result = await collect(parseMarkerStream(toStream('a[SEP][SEP]b')));
    expect(result).toEqual(['a', 'b']);
  });

  it('handles empty stream', async () => {
    const result = await collect(parseMarkerStream(toStream()));
    expect(result).toEqual([]);
  });

  it('handles stream with only whitespace chunks', async () => {
    const result = await collect(parseMarkerStream(toStream('  ', '  ')));
    expect(result).toEqual(['    ']);
  });

  it('preserves SSML tags in output', async () => {
    const result = await collect(parseMarkerStream(toStream('<emotion value="excited"/> hello[SEP]<emotion value="sad"/> world')));
    expect(result).toEqual(['<emotion value="excited"/> hello', '<emotion value="sad"/> world']);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/core/marker-parser.test.ts`
Expected: FAIL — module not found

**Step 3: Implement MarkerParser**

```typescript
const MARKER = '[SEP]';

// eslint-disable-next-line func-style -- async generators require function* syntax
export async function* parseMarkerStream(stream: AsyncIterable<string>): AsyncIterable<string> {
  let buffer = '';

  for await (const token of stream) {
    buffer += token;

    let markerIndex = buffer.indexOf(MARKER);
    while (markerIndex !== -1) {
      const chunk = buffer.slice(0, markerIndex).trim();
      if (chunk.length > 0) {
        yield chunk;
      }
      buffer = buffer.slice(markerIndex + MARKER.length);
      markerIndex = buffer.indexOf(MARKER);
    }

    // Keep potential partial marker at end of buffer
    // Max partial is MARKER.length - 1 = 4 chars: "[", "[S", "[SE", "[SEP"
    // Only retain if buffer ends with a prefix of MARKER
    // This is handled naturally — we just keep the buffer
  }

  const remaining = buffer.trim();
  if (remaining.length > 0) {
    yield remaining;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/core/marker-parser.test.ts`
Expected: ALL PASS

**Step 5: Run lint and typecheck**

Run: `pnpm lint && pnpm typecheck`

**Step 6: Commit**

```bash
git add src/core/marker-parser.ts src/core/marker-parser.test.ts
git commit -m "feat: add MarkerParser for [SEP] stream splitting"
```

---

### Task 3: Add `stream` method to Claude annotator

**Files:**
- Modify: `src/providers/claude-annotator.ts`
- Modify: `src/providers/claude-annotator.test.ts`

**Step 1: Write failing tests for `stream` method**

Add to `claude-annotator.test.ts`. Must also mock `streamText` from `ai`:

```typescript
// Add to vi.mock('ai', ...)
vi.mock('ai', () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
}));

import { generateText, streamText } from 'ai';

const mockStreamText = vi.mocked(streamText);
```

Add test cases:

```typescript
describe('createClaudeAnnotator stream', () => {
  it('returns AsyncIterable of speech chunks parsed by [SEP] markers', async () => {
    // eslint-disable-next-line func-style -- async generators require function* syntax
    async function* fakeTextStream() {
      yield '<emotion value="excited"/> hello[SEP]';
      yield '<emotion value="sad"/> world';
    }
    mockStreamText.mockReturnValue({ textStream: fakeTextStream() } as ReturnType<typeof streamText>);

    const annotator = createClaudeAnnotator();
    const result = await annotator.stream('hello world');

    expect(result.isOk()).toBe(true);
    const chunks: string[] = [];
    for await (const chunk of result._unsafeUnwrap()) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['<emotion value="excited"/> hello', '<emotion value="sad"/> world']);
  });

  it('passes system prompt with [SEP] instructions to streamText', async () => {
    // eslint-disable-next-line func-style -- async generators require function* syntax
    async function* fakeTextStream() {
      yield 'annotated text';
    }
    mockStreamText.mockReturnValue({ textStream: fakeTextStream() } as ReturnType<typeof streamText>);

    const annotator = createClaudeAnnotator();
    await annotator.stream('test');

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('[SEP]'),
        prompt: 'test',
      }),
    );
  });

  it('returns AnnotationError when streamText throws', async () => {
    mockStreamText.mockImplementation(() => {
      throw new Error('API error');
    });

    const annotator = createClaudeAnnotator();
    const result = await annotator.stream('test');

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe('AnnotationError');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/providers/claude-annotator.test.ts`
Expected: FAIL — `stream` method not found

**Step 3: Implement `stream` method**

Update `claude-annotator.ts`:

1. Add import for `streamText` from `'ai'`
2. Add import for `parseMarkerStream` from `'../core/marker-parser.js'`
3. Add `ResultAsync` import (already imported)
4. Create `STREAM_SYSTEM_PROMPT` that extends `SYSTEM_PROMPT` with `[SEP]` rules
5. Add `stream` method to the returned object

The `STREAM_SYSTEM_PROMPT` appends:

```
7. Insert [SEP] between natural speech units (breath pauses, emotion transitions, sentence endings)
8. Do NOT place [SEP] after the final chunk
9. Each [SEP]-delimited segment should be a natural, self-contained speech unit
```

The `stream` method:

```typescript
stream(text: string): ResultAsync<AsyncIterable<string>, AnnotationError> {
  return ResultAsync.fromPromise(
    (async () => {
      const anthropic = createAnthropic(options?.apiKey ? { apiKey: options.apiKey } : {});
      const { textStream } = streamText({
        model: anthropic(options?.model ?? DEFAULT_MODEL),
        system: STREAM_SYSTEM_PROMPT,
        prompt: text,
      });
      return parseMarkerStream(textStream);
    })(),
    (cause): AnnotationError => ({ type: 'AnnotationError', cause }),
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/providers/claude-annotator.test.ts`
Expected: ALL PASS

**Step 5: Run lint and typecheck**

Run: `pnpm lint && pnpm typecheck`

**Step 6: Commit**

```bash
git add src/providers/claude-annotator.ts src/providers/claude-annotator.test.ts
git commit -m "feat: add streaming annotation with [SEP] marker parsing"
```

---

### Task 4: Rewrite pipeline to use streaming annotator

**Files:**
- Modify: `src/core/pipeline.ts`
- Modify: `src/core/pipeline.test.ts`

**Step 1: Write failing tests for new pipeline**

Replace the existing tests. The new pipeline signature:

```typescript
export const runStreamingPipeline = async (
  text: string,
  config: ResolvedConfig,
  ttsClient: TtsClient,
  annotator: TextAnnotator | undefined,
  onChunk: (chunk: Uint8Array) => void,
): Promise<Result<{ chunks: Uint8Array[]; annotatedTexts: string[] }, AppError>>
```

Key changes from old tests:
- First param is `text: string` instead of `sentences: string[]`
- When annotator has `stream`, pipeline uses `annotator.stream(text)` to get speech chunks
- When no annotator, sends full text as single TTS request
- Mock annotators must implement both `annotate` and `stream`

New test helper:

```typescript
const createMockAnnotator = (streamChunks: (string | AnnotationError)[]): TextAnnotator => {
  // eslint-disable-next-line func-style -- async generators require function* syntax
  async function* makeChunkStream(): AsyncIterable<string> {
    for (const chunk of streamChunks) {
      if (typeof chunk !== 'string') throw chunk;
      yield chunk;
    }
  }
  return {
    annotate: vi.fn().mockReturnValue(okAsync(streamChunks.filter((c) => typeof c === 'string').join(''))),
    stream: vi.fn().mockReturnValue(okAsync(makeChunkStream())),
  };
};
```

Test cases to write:
1. Sends full text as single TTS request when no annotator
2. Uses annotator.stream to get speech chunks, sends each to TTS
3. Collects annotated texts from stream chunks
4. Returns AnnotationError when stream fails
5. Returns TtsError when TTS generate fails
6. Returns empty result for empty text
7. Calls onChunk for every PCM chunk across all speech units

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/core/pipeline.test.ts`
Expected: FAIL

**Step 3: Implement new pipeline**

```typescript
import { ok, err, type Result } from 'neverthrow';
import type { AppError, ResolvedConfig, TextAnnotator, TtsClient } from '../types.js';

const consumeStream = async (stream: AsyncIterable<Uint8Array>, onChunk: (chunk: Uint8Array) => void): Promise<Uint8Array[]> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    onChunk(chunk);
  }
  return chunks;
};

export const runStreamingPipeline = async (
  text: string,
  config: ResolvedConfig,
  ttsClient: TtsClient,
  annotator: TextAnnotator | undefined,
  onChunk: (chunk: Uint8Array) => void,
): Promise<Result<{ chunks: Uint8Array[]; annotatedTexts: string[] }, AppError>> => {
  if (text.trim().length === 0) {
    return ok({ chunks: [], annotatedTexts: [] });
  }

  const allChunks: Uint8Array[] = [];
  const annotatedTexts: string[] = [];

  // Get speech chunks: from annotator stream or full text as single chunk
  let speechChunks: AsyncIterable<string>;
  if (annotator) {
    const streamResult = await annotator.stream(text);
    if (streamResult.isErr()) return err(streamResult.error);
    speechChunks = streamResult.value;
  } else {
    // eslint-disable-next-line func-style -- async generators require function* syntax
    async function* singleChunk() { yield text; }
    speechChunks = singleChunk();
  }

  // Process each speech chunk through TTS
  for await (const speechText of speechChunks) {
    annotatedTexts.push(speechText);
    const ttsResult = await ttsClient.generate({ ...config, text: speechText });
    if (ttsResult.isErr()) return err(ttsResult.error);
    const chunks = await consumeStream(ttsResult.value, onChunk);
    allChunks.push(...chunks);
  }

  return ok({ chunks: allChunks, annotatedTexts });
};
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/core/pipeline.test.ts`
Expected: ALL PASS

**Step 5: Run lint and typecheck**

Run: `pnpm lint && pnpm typecheck`

**Step 6: Commit**

```bash
git add src/core/pipeline.ts src/core/pipeline.test.ts
git commit -m "refactor: pipeline uses annotator.stream instead of sentence splitting"
```

---

### Task 5: Update download command to remove splitSentences

**Files:**
- Modify: `src/commands/download.ts`
- Modify: `src/commands/download.test.ts`

**Step 1: Update download.ts**

Remove:
- `import { splitSentences } from '../core/sentence-splitter.js';`
- `const sentences = splitSentences(config.text);`

Change `runStreamingPipeline` call:
- Pass `config.text` instead of `sentences`

The pipeline call becomes:
```typescript
return ResultAsync.fromPromise(
  runStreamingPipeline(config.text, config, ttsClient, effectiveAnnotator, (chunk) => {
    stdout.write(chunk);
  }),
  (cause): AppError => ({ type: 'TtsApiError', cause }),
)
```

**Step 2: Update download.test.ts**

Update `createMockAnnotator` to include `stream` method:

```typescript
const createMockAnnotator = (result: string | AnnotationError): TextAnnotator => {
  // eslint-disable-next-line func-style -- async generators require function* syntax
  async function* singleChunk(text: string): AsyncIterable<string> { yield text; }
  return {
    annotate: vi.fn().mockReturnValue(typeof result === 'string' ? okAsync(result) : errAsync(result)),
    stream: vi.fn().mockImplementation((text: string) =>
      typeof result === 'string' ? okAsync(singleChunk(result)) : errAsync(result),
    ),
  };
};
```

**Step 3: Run tests**

Run: `pnpm vitest run src/commands/download.test.ts`
Expected: ALL PASS

**Step 4: Run full test suite**

Run: `pnpm test`
Expected: ALL PASS (except sentence-splitter tests which reference deleted code)

**Step 5: Commit**

```bash
git add src/commands/download.ts src/commands/download.test.ts
git commit -m "refactor: remove splitSentences from download pipeline"
```

---

### Task 6: Delete sentence-splitter module

**Files:**
- Delete: `src/core/sentence-splitter.ts`
- Delete: `src/core/sentence-splitter.test.ts`

**Step 1: Verify no remaining imports**

Run: `grep -r "sentence-splitter" src/`
Expected: no results (already removed in Task 5)

**Step 2: Delete files**

```bash
rm src/core/sentence-splitter.ts src/core/sentence-splitter.test.ts
```

**Step 3: Run full test suite and typecheck**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove unused sentence-splitter module"
```

---

### Task 7: E2E validation

**Step 1: Run with emotion annotation**

```bash
npx tsx src/cli.ts --text "わざわざキッチンから醤油持ってきたのにって醤油！？え！？しょしょしょ醤油！？え、なんで！？お湯！？お湯割りで飲むのか！？流行ってるの！？何！！何これどういうこと！？俺違う世界きちゃった！？け、健康に悪いからとりあえずやめな！？な！！" --output e2e-streaming-test.wav
```

Verify:
- WAV file created
- `.txt` annotation file shows SSML tags with `[SEP]` stripped
- Audio sounds more natural than previous sentence-split approach

**Step 2: Run without annotation**

```bash
npx tsx src/cli.ts --text "こんにちは、今日はいい天気ですね。" --no-annotate --output e2e-no-annotate.wav
```

Verify:
- WAV file created with single TTS request
- No `.txt` file created

**Step 3: Clean up test files**

```bash
rm e2e-streaming-test.wav e2e-streaming-test.txt e2e-no-annotate.wav
```
