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
    async function* singleChunk() {
      yield text;
    }
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
