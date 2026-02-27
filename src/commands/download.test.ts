import { describe, it, expect, vi } from 'vitest';
import { okAsync, errAsync } from 'neverthrow';
import { Writable } from 'node:stream';
import { runDownload } from './download.js';
import type { TtsClient, TextAnnotator, IO, IOError, TtsError, AnnotationError } from '../types.js';

// eslint-disable-next-line func-style -- async generators require function* syntax
async function* makeStream(...chunks: Uint8Array[]): AsyncIterable<Uint8Array> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

const createMockTtsClient = (streamOrError?: AsyncIterable<Uint8Array> | TtsError): TtsClient => ({
  generate: vi.fn().mockReturnValue(streamOrError && 'type' in (streamOrError as TtsError) ? errAsync(streamOrError as TtsError) : okAsync(streamOrError ?? makeStream(new Uint8Array([1, 2, 3])))),
});

const createMockAnnotator = (result: string | AnnotationError): TextAnnotator => ({
  annotate: vi.fn().mockReturnValue(typeof result === 'string' ? okAsync(result) : errAsync(result)),
});

const createMockIO = (overrides?: Partial<IO>): IO => ({
  readTextFile: overrides?.readTextFile ?? vi.fn().mockReturnValue(okAsync('file content')),
  readRcFile: overrides?.readRcFile ?? vi.fn().mockReturnValue(okAsync({})),
  writeFile: overrides?.writeFile ?? vi.fn().mockReturnValue(okAsync(undefined)),
});

const createMockStdout = (): NodeJS.WritableStream => {
  const chunks: Buffer[] = [];
  const writable = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  return writable;
};

const createMockDeps = (overrides?: { ttsClient?: TtsClient; io?: IO; annotator?: TextAnnotator; stdout?: NodeJS.WritableStream }) => ({
  ttsClient: overrides?.ttsClient ?? createMockTtsClient(),
  io: overrides?.io ?? createMockIO(),
  annotator: overrides?.annotator,
  stdout: overrides?.stdout ?? createMockStdout(),
});

describe('runDownload', () => {
  it('streams audio chunks to stdout', async () => {
    const audioChunk = new Uint8Array([1, 2, 3, 4]);
    const ttsClient = createMockTtsClient(makeStream(audioChunk));
    const stdout = createMockStdout();

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, stdout }));

    expect(result.isOk()).toBe(true);
    expect(ttsClient.generate).toHaveBeenCalledOnce();
  });

  it('writes WAV file when --output is specified', async () => {
    const audioChunk = new Uint8Array([0x01, 0x02]);
    const ttsClient = createMockTtsClient(makeStream(audioChunk));
    const io = createMockIO();

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: '/tmp/out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, io }));

    expect(result.isOk()).toBe(true);
    expect(io.writeFile).toHaveBeenCalledOnce();
    // First arg is the path
    const writeCall = (io.writeFile as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(writeCall[0]).toBe('/tmp/out.wav');
    // Second arg is Buffer starting with RIFF header (44 bytes) + PCM data
    const writtenData = writeCall[1] as Buffer;
    expect(writtenData.slice(0, 4).toString()).toBe('RIFF');
    expect(writtenData.length).toBe(44 + audioChunk.length);
  });

  it('succeeds without --output (stdout only)', async () => {
    const ttsClient = createMockTtsClient();

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient }));

    expect(result.isOk()).toBe(true);
  });

  it('reads text from --input file', async () => {
    const ttsClient = createMockTtsClient();
    const io = createMockIO({ readTextFile: vi.fn().mockReturnValue(okAsync('file content')) });

    const result = await runDownload({ input: '/tmp/test.txt', 'voice-id': 'v1' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, io }));

    expect(result.isOk()).toBe(true);
    expect(io.readTextFile).toHaveBeenCalledWith('/tmp/test.txt');
  });

  it('returns error when --input file read fails', async () => {
    const fileReadError: IOError = { type: 'FileReadError', path: '/tmp/missing.txt', cause: new Error('ENOENT') };
    const io = createMockIO({ readTextFile: vi.fn().mockReturnValue(errAsync(fileReadError)) });

    const result = await runDownload({ input: '/tmp/missing.txt', 'voice-id': 'v1' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ io }));

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(fileReadError);
  });

  it('returns error when config resolution fails (missing apiKey)', async () => {
    const result = await runDownload({ text: 'hello', 'voice-id': 'v1' }, {}, createMockDeps());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({ type: 'MissingApiKey' });
  });

  it('returns error when TTS generation fails', async () => {
    const apiError: TtsError = { type: 'TtsApiError', cause: new Error('API down') };
    const ttsClient = createMockTtsClient(apiError);

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient }));

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(apiError);
  });

  it('annotates text when annotator is provided', async () => {
    const ttsClient = createMockTtsClient();
    const annotator = createMockAnnotator('<emotion>hello</emotion>');

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, annotator }));

    expect(result.isOk()).toBe(true);
    expect(annotator.annotate).toHaveBeenCalled();
  });

  it('writes annotation txt file when text is annotated and output specified', async () => {
    const ttsClient = createMockTtsClient();
    const annotator = createMockAnnotator('<emotion>hello</emotion>');
    const io = createMockIO();

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: '/tmp/out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, annotator, io }));

    expect(result.isOk()).toBe(true);
    // Should have 2 writeFile calls: WAV + annotation txt
    expect((io.writeFile as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
    const txtCall = (io.writeFile as ReturnType<typeof vi.fn>).mock.calls.find((c: unknown[]) => (c[0] as string).endsWith('.txt'));
    expect(txtCall).toBeDefined();
    expect(txtCall![0]).toBe('/tmp/out.txt');
  });

  it('does not write annotation txt when text is unchanged', async () => {
    const ttsClient = createMockTtsClient();
    const io = createMockIO();

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: '/tmp/out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, io }));

    expect(result.isOk()).toBe(true);
    // Only WAV write, no txt write
    expect((io.writeFile as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it('skips annotation when no-annotate is true', async () => {
    const ttsClient = createMockTtsClient();
    const annotator = createMockAnnotator('should not be called');

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1', 'no-annotate': true }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, annotator }));

    expect(result.isOk()).toBe(true);
    expect(annotator.annotate).not.toHaveBeenCalled();
  });

  it('returns error when annotation fails', async () => {
    const annotationError: AnnotationError = { type: 'AnnotationError', cause: new Error('LLM down') };
    const annotator = createMockAnnotator(annotationError);

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ annotator }));

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(annotationError);
  });

  it('prefers --text over --input when both provided', async () => {
    const ttsClient = createMockTtsClient();
    const io = createMockIO();

    const result = await runDownload({ text: 'from cli', input: '/tmp/file.txt', 'voice-id': 'v1' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, io }));

    expect(result.isOk()).toBe(true);
    expect(io.readTextFile).not.toHaveBeenCalled();
  });
});
