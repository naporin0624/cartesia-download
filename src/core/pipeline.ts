import { ok, err, okAsync, type Result } from 'neverthrow';
import type { AppError, ResolvedConfig, TextAnnotator, TtsClient } from '../types.js';

type PreparedSentence = {
  text: string;
  stream: AsyncIterable<Uint8Array>;
};

const prepareSentence = async (sentence: string, config: ResolvedConfig, ttsClient: TtsClient, annotator: TextAnnotator | undefined): Promise<Result<PreparedSentence, AppError>> => {
  const result = await (annotator ? annotator.annotate(sentence) : okAsync(sentence)).andThen((annotated) =>
    ttsClient.generate({ ...config, text: annotated }).map((stream): PreparedSentence => ({ text: annotated, stream })),
  );
  return result;
};

const consumeStream = async (stream: AsyncIterable<Uint8Array>, onChunk: (chunk: Uint8Array) => void): Promise<Uint8Array[]> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    onChunk(chunk);
  }
  return chunks;
};

export const runStreamingPipeline = async (
  sentences: string[],
  config: ResolvedConfig,
  ttsClient: TtsClient,
  annotator: TextAnnotator | undefined,
  onChunk: (chunk: Uint8Array) => void,
): Promise<Result<{ chunks: Uint8Array[]; annotatedTexts: string[] }, AppError>> => {
  if (sentences.length === 0) {
    return ok({ chunks: [], annotatedTexts: [] });
  }

  const allChunks: Uint8Array[] = [];
  const annotatedTexts: string[] = [];

  for (const sentence of sentences) {
    const prepared = await prepareSentence(sentence, config, ttsClient, annotator);
    if (prepared.isErr()) return err(prepared.error);

    annotatedTexts.push(prepared.value.text);
    const sentenceChunks = await consumeStream(prepared.value.stream, onChunk);
    allChunks.push(...sentenceChunks);
  }

  return ok({ chunks: allChunks, annotatedTexts });
};
