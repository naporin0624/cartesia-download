import { describe, it, expect, vi } from 'vitest';
import { okAsync, errAsync, ResultAsync } from 'neverthrow';
import { runDownload } from './download.js';
import type { TtsClient, FileOutput, TtsResult, CartesiaDownloadError, TextAnnotator, RcConfig } from '../types.js';

const createMockTtsClient = (result: TtsResult | CartesiaDownloadError): TtsClient => ({
  generate: vi.fn().mockReturnValue('audioData' in result ? okAsync(result) : errAsync(result)),
});

const createMockFileOutput = (error?: CartesiaDownloadError): FileOutput => ({
  write: vi.fn().mockReturnValue(error ? errAsync(error) : okAsync(undefined)),
});

const createMockAnnotator = (result: string | CartesiaDownloadError): TextAnnotator => ({
  annotate: vi.fn().mockReturnValue(typeof result === 'string' ? okAsync(result) : errAsync(result)),
});

const audioData = new ArrayBuffer(16);

const createMockDeps = (overrides?: {
  ttsClient?: TtsClient;
  fileOutput?: FileOutput;
  readTextFile?: (filePath: string) => ResultAsync<string, CartesiaDownloadError>;
  readRcFile?: (path: string) => Promise<RcConfig>;
  annotator?: TextAnnotator;
}) => ({
  ttsClient: overrides?.ttsClient ?? createMockTtsClient({ audioData, format: 'wav' }),
  fileOutput: overrides?.fileOutput ?? createMockFileOutput(),
  readTextFile: overrides?.readTextFile ?? vi.fn<(filePath: string) => ResultAsync<string, CartesiaDownloadError>>().mockReturnValue(okAsync('file content')),
  readRcFile: overrides?.readRcFile ?? vi.fn<(path: string) => Promise<RcConfig>>().mockResolvedValue({}),
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

    const result = await runDownload(
      { input: '/tmp/test-input.txt', 'voice-id': 'v1', output: 'out.wav' },
      { CARTESIA_API_KEY: 'key1' },
      createMockDeps({
        ttsClient,
        fileOutput,
        readTextFile: vi.fn<(filePath: string) => ResultAsync<string, CartesiaDownloadError>>().mockReturnValue(okAsync('file content')),
      }),
    );

    expect(result.isOk()).toBe(true);
    expect(ttsClient.generate).toHaveBeenCalledOnce();
    const config = (ttsClient.generate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(config.text).toBe('file content');
  });

  it('returns error when --input file read fails', async () => {
    const ttsClient = createMockTtsClient({ audioData, format: 'wav' });
    const fileReadError: CartesiaDownloadError = {
      type: 'FileReadError',
      path: '/tmp/missing.txt',
      cause: new Error('ENOENT'),
    };

    const result = await runDownload(
      { input: '/tmp/missing.txt', 'voice-id': 'v1', output: 'out.wav' },
      { CARTESIA_API_KEY: 'key1' },
      createMockDeps({
        ttsClient,
        readTextFile: vi.fn<(filePath: string) => ResultAsync<string, CartesiaDownloadError>>().mockReturnValue(errAsync(fileReadError)),
      }),
    );

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
    const apiError: CartesiaDownloadError = { type: 'TtsApiError', cause: new Error('API down') };
    const ttsClient = createMockTtsClient(apiError);

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: 'out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient }));

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(apiError);
  });

  it('returns error when file write fails', async () => {
    const ttsResult: TtsResult = { audioData, format: 'wav' };
    const writeError: CartesiaDownloadError = {
      type: 'FileWriteError',
      path: 'out.wav',
      cause: new Error('disk full'),
    };
    const ttsClient = createMockTtsClient(ttsResult);
    const fileOutput = createMockFileOutput(writeError);

    const result = await runDownload({ text: 'hello', 'voice-id': 'v1', output: 'out.wav' }, { CARTESIA_API_KEY: 'key1' }, createMockDeps({ ttsClient, fileOutput }));

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(writeError);
  });

  it('prefers --text over --input when both provided', async () => {
    const ttsResult: TtsResult = { audioData, format: 'wav' };
    const ttsClient = createMockTtsClient(ttsResult);
    const readTextFileMock = vi.fn<(filePath: string) => ResultAsync<string, CartesiaDownloadError>>().mockReturnValue(okAsync('from file'));

    const result = await runDownload(
      { text: 'from cli', input: '/tmp/file.txt', 'voice-id': 'v1', output: 'out.wav' },
      { CARTESIA_API_KEY: 'key1' },
      createMockDeps({ ttsClient, readTextFile: readTextFileMock }),
    );

    expect(result.isOk()).toBe(true);
    expect(readTextFileMock).not.toHaveBeenCalled();
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
    const annotationError: CartesiaDownloadError = { type: 'AnnotationError', cause: new Error('LLM down') };
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
