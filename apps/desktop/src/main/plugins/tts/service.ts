import { CartesiaClient } from '@cartesia/cartesia-js';
import { buildWavHeader, createAnnotator, createCartesiaTtsClient, runStreamingPipeline } from '@cartesia-download/core';
import type { GenerateResult, TtsOptions, TtsService } from '@shared/plugins/tts/service';
import type { Logger } from '@shared/callable/index';

export const createTtsServiceFactory = (getApiKeys: () => { cartesiaApiKey: string; anthropicApiKey: string }, logger: Logger): TtsService => ({
  generate: async (text: string, options: TtsOptions): Promise<GenerateResult> => {
    const { cartesiaApiKey, anthropicApiKey } = getApiKeys();

    logger.debug('[tts:service] creating Cartesia client', { hasApiKey: !!cartesiaApiKey });
    const cartesia = new CartesiaClient({ apiKey: cartesiaApiKey });
    const ttsClient = createCartesiaTtsClient(cartesia);

    logger.debug('[tts:service] annotator config', { annotate: options.annotate, hasAnthropicKey: !!anthropicApiKey });
    const annotator =
      options.annotate && anthropicApiKey
        ? createAnnotator('claude', { apiKey: anthropicApiKey, systemPrompt: options.systemPrompt }).match(
            (a) => {
              logger.debug('[tts:service] annotator created');
              return a;
            },
            (err) => {
              logger.warn('[tts:service] annotator creation failed', err);
              return undefined;
            },
          )
        : undefined;

    const config = {
      apiKey: cartesiaApiKey,
      voiceId: options.voiceId,
      model: options.model,
      sampleRate: options.sampleRate,
      language: options.language,
      text,
    };
    logger.debug('[tts:service] pipeline config', { voiceId: config.voiceId, model: config.model, language: config.language, sampleRate: config.sampleRate });

    const chunks: Uint8Array[] = [];
    logger.debug('[tts:service] starting streaming pipeline');
    const result = await runStreamingPipeline(text, config, ttsClient, annotator, (chunk) => {
      chunks.push(chunk);
      logger.debug('[tts:service] received chunk', { index: chunks.length, size: chunk.byteLength });
    });

    if (result.isErr()) {
      logger.error('[tts:service] pipeline failed', JSON.stringify(result.error));
      throw new Error(`TTS generation failed: ${JSON.stringify(result.error)}`);
    }

    logger.debug('[tts:service] pipeline complete', { totalChunks: chunks.length, annotatedTexts: result.value.annotatedTexts.length });

    const pcmData = concatUint8Arrays(chunks);
    const wavHeader = buildWavHeader({
      dataByteLength: pcmData.byteLength,
      sampleRate: options.sampleRate,
      numChannels: 1,
      bitsPerSample: 16,
    });

    const wav = new Uint8Array(wavHeader.byteLength + pcmData.byteLength);
    wav.set(new Uint8Array(wavHeader.buffer, wavHeader.byteOffset, wavHeader.byteLength), 0);
    wav.set(pcmData, wavHeader.byteLength);

    const annotatedText = result.value.annotatedTexts.length > 0 ? result.value.annotatedTexts.join('\n') : undefined;

    logger.info('[tts:service] generation complete', { wavSize: wav.byteLength, hasAnnotation: !!annotatedText });
    return { wav: wav.buffer, annotatedText };
  },
});

const concatUint8Arrays = (arrays: Uint8Array[]): Uint8Array => {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.byteLength;
  }
  return result;
};
