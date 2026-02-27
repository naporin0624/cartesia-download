# Streaming Annotation Design

## Problem

Current pipeline splits text with regex (`splitSentences`), annotates each sentence independently via `generateText`, and concatenates PCM chunks. This causes:

- Prosodic discontinuity at sentence boundaries (each TTS call generates independent intonation)
- Loss of emotional context (Claude sees only isolated sentences)
- Aggressive splitting on every `。！？` creates unnaturally short fragments

## Solution

Replace sentence-level batch processing with a streaming annotation pipeline. Claude receives the full text, annotates it with SSML tags, inserts `[SEP]` markers at natural speech boundaries, and streams the response. As each `[SEP]`-delimited chunk arrives, it is immediately sent to TTS for generation.

## Data Flow

```
Input text (full)
    ↓
Claude streamText (full text → SSML + [SEP] markers)
    ↓ token stream
MarkerParser (buffer + [SEP] detection → AsyncIterable<string>)
    ↓ speech chunks
TTS generate (per chunk, sequential)
    ↓ PCM stream
stdout / WAV file
```

`--no-annotate` skips Claude entirely and sends the full text as a single TTS request.

## Interface Changes

### TextAnnotator

```typescript
interface TextAnnotator {
  annotate(text: string): ResultAsync<string, AnnotationError>;
  stream(text: string): ResultAsync<AsyncIterable<string>, AnnotationError>;
}
```

- `stream` returns an `AsyncIterable<string>` that yields `[SEP]`-delimited chunks with markers stripped
- `annotate` remains for backward compatibility
- Marker parsing is encapsulated inside the annotator (Claude-specific concern)

## Claude Prompt Changes

Add to `SYSTEM_PROMPT`:

```
- Insert [SEP] between natural speech units
- Place [SEP] at sentence endings, emotion transitions, or breath pauses
- Do NOT place [SEP] after the final chunk
```

## MarkerParser

AsyncGenerator that buffers `streamText` text deltas and yields on `[SEP]` detection:

- Handles token boundary splits (e.g., `[S` + `EP]`)
- Strips `[SEP]` from output
- Flushes remaining buffer on stream end
- Pure function, easy to unit test

## Pipeline Changes

| Aspect           | Before                      | After                                               |
| ---------------- | --------------------------- | --------------------------------------------------- |
| Text splitting   | `splitSentences` (regex)    | Claude `[SEP]` markers / full text if no annotation |
| Annotation       | Per-sentence `generateText` | Full-text `streamText`                              |
| TTS requests     | Per regex-split sentence    | Per Claude-determined speech unit / single request  |
| `splitSentences` | Used                        | Deleted                                             |

## Files Affected

- `src/types.ts` — add `stream` to `TextAnnotator`
- `src/providers/claude-annotator.ts` — add `stream` method, update prompt, add MarkerParser
- `src/core/pipeline.ts` — rewrite to consume `AsyncIterable<string>` from annotator
- `src/commands/download.ts` — remove `splitSentences` usage
- `src/core/sentence-splitter.ts` — delete
- Test files — update accordingly
