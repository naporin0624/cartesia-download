import { describe, it, expect, vi } from 'vitest';
import { okAsync, errAsync } from 'neverthrow';
import { runDownload } from './download.js';
import type { TtsClient, FileOutput, TtsResult, TextAnnotator, IO, IOError, TtsError, AnnotationError } from '../types.js';

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
