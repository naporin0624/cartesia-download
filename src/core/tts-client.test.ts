import { describe, it, expect, vi } from 'vitest';
import { buildRawOutputFormat, createCartesiaTtsClient } from './tts-client.js';
import type { ResolvedConfig } from '../types.js';

const baseConfig: ResolvedConfig = {
  apiKey: 'test-api-key',
  voiceId: 'test-voice-id',
  model: 'sonic-3',
  sampleRate: 44100,
  outputPath: '/tmp/output.wav',
  text: 'Hello, world!',
};

// eslint-disable-next-line func-style -- async generators require function* syntax
async function* createMockAsyncIterable(data: Buffer): AsyncIterable<Uint8Array> {
  yield new Uint8Array(data);
}

describe('buildRawOutputFormat', () => {
  it('returns raw format with pcm_s16le encoding', () => {
    const result = buildRawOutputFormat(44100);
    expect(result).toEqual({ container: 'raw', sampleRate: 44100, encoding: 'pcm_s16le' });
  });

  it('respects different sample rates', () => {
    const result = buildRawOutputFormat(22050);
    expect(result).toEqual({ container: 'raw', sampleRate: 22050, encoding: 'pcm_s16le' });
  });
});

describe('createCartesiaTtsClient', () => {
  it('calls client.tts.bytes with correct parameters and returns AsyncIterable', async () => {
    const fakeAudioData = Buffer.from('fake-audio-data');
    const mockClient = {
      tts: {
        bytes: vi.fn().mockResolvedValue(createMockAsyncIterable(fakeAudioData)),
      },
    };

    const ttsClient = createCartesiaTtsClient(mockClient);
    const result = await ttsClient.generate(baseConfig);

    expect(mockClient.tts.bytes).toHaveBeenCalledOnce();
    expect(mockClient.tts.bytes).toHaveBeenCalledWith({
      modelId: 'sonic-3',
      transcript: 'Hello, world!',
      voice: { mode: 'id', id: 'test-voice-id' },
      language: 'ja',
      outputFormat: {
        container: 'raw',
        sampleRate: 44100,
        encoding: 'pcm_s16le',
      },
    });

    expect(result.isOk()).toBe(true);
    const stream = result._unsafeUnwrap();
    expect(typeof (stream as AsyncIterable<Uint8Array>)[Symbol.asyncIterator]).toBe('function');
  });

  it('returns TtsApiError when client.tts.bytes throws', async () => {
    const apiError = new Error('API rate limit exceeded');
    const mockClient = {
      tts: {
        bytes: vi.fn().mockRejectedValue(apiError),
      },
    };

    const ttsClient = createCartesiaTtsClient(mockClient);
    const result = await ttsClient.generate(baseConfig);

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error.type).toBe('TtsApiError');
    expect((error as { type: 'TtsApiError'; cause: unknown }).cause).toBe(apiError);
  });
});
