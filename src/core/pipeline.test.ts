import { describe, it, expect, vi } from 'vitest';
import { okAsync, errAsync } from 'neverthrow';
import { runStreamingPipeline } from './pipeline.js';
import type { ResolvedConfig, TtsClient, TextAnnotator, TtsError, AnnotationError } from '../types.js';

// eslint-disable-next-line func-style -- async generators require function* syntax
async function* makeChunks(...chunks: Uint8Array[]): AsyncIterable<Uint8Array> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

const baseConfig: ResolvedConfig = {
  apiKey: 'test-key',
  voiceId: 'test-voice',
  model: 'sonic-3',
  sampleRate: 44100,
  outputPath: undefined,
  text: 'unused in pipeline',
};

const createMockTtsClient = (streamsOrError: AsyncIterable<Uint8Array>[] | TtsError): TtsClient => {
  if ('type' in streamsOrError) {
    return { generate: vi.fn().mockReturnValue(errAsync(streamsOrError)) };
  }
  const streams = streamsOrError;
  const generate = vi.fn();
  for (const stream of streams) {
    generate.mockReturnValueOnce(okAsync(stream));
  }
  return { generate };
};

const createMockAnnotator = (results: (string | AnnotationError)[]): TextAnnotator => {
  const annotate = vi.fn();
  for (const result of results) {
    if (typeof result === 'string') {
      annotate.mockReturnValueOnce(okAsync(result));
    } else {
      annotate.mockReturnValueOnce(errAsync(result));
    }
  }
  return { annotate };
};

describe('runStreamingPipeline', () => {
  it('processes a single sentence without annotator and calls onChunk for each chunk', async () => {
    const chunk1 = new Uint8Array([1, 2]);
    const chunk2 = new Uint8Array([3, 4]);
    const ttsClient = createMockTtsClient([makeChunks(chunk1, chunk2)]);
    const onChunk = vi.fn();

    const result = await runStreamingPipeline(['hello world'], baseConfig, ttsClient, undefined, onChunk);

    expect(result.isOk()).toBe(true);
    const { chunks, annotatedTexts } = result._unsafeUnwrap();
    expect(chunks).toEqual([chunk1, chunk2]);
    expect(annotatedTexts).toEqual(['hello world']);
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, chunk1);
    expect(onChunk).toHaveBeenNthCalledWith(2, chunk2);
  });

  it('passes sentence text as config.text to TTS generate', async () => {
    const ttsClient = createMockTtsClient([makeChunks(new Uint8Array([1]))]);
    const onChunk = vi.fn();

    await runStreamingPipeline(['test sentence'], baseConfig, ttsClient, undefined, onChunk);

    const generateMock = ttsClient.generate as ReturnType<typeof vi.fn>;
    expect(generateMock).toHaveBeenCalledOnce();
    expect(generateMock.mock.calls[0][0]).toMatchObject({ ...baseConfig, text: 'test sentence' });
  });

  it('collects all chunks from multiple sentences in order', async () => {
    const chunk0 = new Uint8Array([10]);
    const chunk1 = new Uint8Array([20]);
    const chunk2 = new Uint8Array([30]);
    const ttsClient = createMockTtsClient([makeChunks(chunk0), makeChunks(chunk1), makeChunks(chunk2)]);
    const onChunk = vi.fn();

    const result = await runStreamingPipeline(['sentence 1', 'sentence 2', 'sentence 3'], baseConfig, ttsClient, undefined, onChunk);

    expect(result.isOk()).toBe(true);
    const { chunks, annotatedTexts } = result._unsafeUnwrap();
    expect(chunks).toEqual([chunk0, chunk1, chunk2]);
    expect(annotatedTexts).toEqual(['sentence 1', 'sentence 2', 'sentence 3']);
  });

  it('calls TTS generate once per sentence when no annotator is provided', async () => {
    const ttsClient = createMockTtsClient([makeChunks(new Uint8Array([1])), makeChunks(new Uint8Array([2])), makeChunks(new Uint8Array([3]))]);
    const onChunk = vi.fn();

    await runStreamingPipeline(['a', 'b', 'c'], baseConfig, ttsClient, undefined, onChunk);

    expect(ttsClient.generate).toHaveBeenCalledTimes(3);
  });

  it('annotates each sentence and passes annotated text to TTS generate', async () => {
    const annotator = createMockAnnotator(['<emotion>hello</emotion>', '<emotion>world</emotion>']);
    const ttsClient = createMockTtsClient([makeChunks(new Uint8Array([1])), makeChunks(new Uint8Array([2]))]);
    const onChunk = vi.fn();

    const result = await runStreamingPipeline(['hello', 'world'], baseConfig, ttsClient, annotator, onChunk);

    expect(result.isOk()).toBe(true);
    const { annotatedTexts } = result._unsafeUnwrap();
    expect(annotatedTexts).toEqual(['<emotion>hello</emotion>', '<emotion>world</emotion>']);
    expect(annotator.annotate).toHaveBeenCalledTimes(2);
    expect(annotator.annotate).toHaveBeenNthCalledWith(1, 'hello');
    expect(annotator.annotate).toHaveBeenNthCalledWith(2, 'world');
    const generateMock = ttsClient.generate as ReturnType<typeof vi.fn>;
    expect(generateMock.mock.calls[0][0]).toMatchObject({ text: '<emotion>hello</emotion>' });
    expect(generateMock.mock.calls[1][0]).toMatchObject({ text: '<emotion>world</emotion>' });
  });

  it('returns AnnotationError and does not call TTS generate when annotation fails', async () => {
    const annotationError: AnnotationError = { type: 'AnnotationError', cause: new Error('LLM down') };
    const annotator = createMockAnnotator([annotationError]);
    const ttsClient = createMockTtsClient([makeChunks(new Uint8Array([1]))]);
    const onChunk = vi.fn();

    const result = await runStreamingPipeline(['hello'], baseConfig, ttsClient, annotator, onChunk);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(annotationError);
    expect(ttsClient.generate).not.toHaveBeenCalled();
  });

  it('returns TtsApiError when TTS client generate fails', async () => {
    const ttsError: TtsError = { type: 'TtsApiError', cause: new Error('API down') };
    const ttsClient = createMockTtsClient(ttsError);
    const onChunk = vi.fn();

    const result = await runStreamingPipeline(['hello'], baseConfig, ttsClient, undefined, onChunk);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(ttsError);
  });

  it('returns ok with empty chunks and annotatedTexts for an empty sentences array', async () => {
    const ttsClient = createMockTtsClient([]);
    const onChunk = vi.fn();

    const result = await runStreamingPipeline([], baseConfig, ttsClient, undefined, onChunk);

    expect(result.isOk()).toBe(true);
    const { chunks, annotatedTexts } = result._unsafeUnwrap();
    expect(chunks).toEqual([]);
    expect(annotatedTexts).toEqual([]);
    expect(ttsClient.generate).not.toHaveBeenCalled();
    expect(onChunk).not.toHaveBeenCalled();
  });

  it('calls onChunk for every chunk across all sentences', async () => {
    const chunkA1 = new Uint8Array([1]);
    const chunkA2 = new Uint8Array([2]);
    const chunkB1 = new Uint8Array([3]);
    const chunkB2 = new Uint8Array([4]);
    const ttsClient = createMockTtsClient([makeChunks(chunkA1, chunkA2), makeChunks(chunkB1, chunkB2)]);
    const onChunk = vi.fn();

    const result = await runStreamingPipeline(['sentence A', 'sentence B'], baseConfig, ttsClient, undefined, onChunk);

    expect(result.isOk()).toBe(true);
    expect(onChunk).toHaveBeenCalledTimes(4);
    expect(onChunk).toHaveBeenCalledWith(chunkA1);
    expect(onChunk).toHaveBeenCalledWith(chunkA2);
    expect(onChunk).toHaveBeenCalledWith(chunkB1);
    expect(onChunk).toHaveBeenCalledWith(chunkB2);
  });
});
