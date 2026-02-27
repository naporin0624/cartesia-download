import { ResultAsync } from 'neverthrow';
import type { ResolvedConfig, TtsClient, TtsError } from '../types.js';

export type RawOutputFormat = {
  container: 'raw';
  sampleRate: number;
  encoding: 'pcm_s16le';
};

export const buildRawOutputFormat = (sampleRate: number): RawOutputFormat => ({
  container: 'raw',
  sampleRate,
  encoding: 'pcm_s16le',
});

export interface CartesiaLikeClient {
  tts: {
    bytes: (params: { modelId: string; transcript: string; voice: { mode: 'id'; id: string }; language?: string; outputFormat: RawOutputFormat }) => Promise<AsyncIterable<Uint8Array>>;
  };
}

export const createCartesiaTtsClient = (client: CartesiaLikeClient): TtsClient => ({
  generate(config: ResolvedConfig): ResultAsync<AsyncIterable<Uint8Array>, TtsError> {
    return ResultAsync.fromPromise(
      client.tts.bytes({
        modelId: config.model,
        transcript: config.text,
        voice: { mode: 'id', id: config.voiceId },
        language: 'ja',
        outputFormat: buildRawOutputFormat(config.sampleRate),
      }),
      (cause): TtsError => ({ type: 'TtsApiError', cause }),
    );
  },
});
