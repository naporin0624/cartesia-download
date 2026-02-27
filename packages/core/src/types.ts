import type { ResultAsync } from 'neverthrow';

export interface TtsConfig {
  apiKey: string;
  voiceId: string;
  model: string;
  sampleRate: number;
  language: string;
  text: string;
}

// --- Module-scoped error types ---

export type TtsError = { type: 'TtsApiError'; cause: unknown } | { type: 'TtsStreamError'; sentenceIndex: number; cause: unknown };

export type AnnotationError = { type: 'AnnotationError'; cause: unknown } | { type: 'UnsupportedProvider'; provider: string };

export type CoreError = TtsError | AnnotationError;

// --- Interfaces with module-scoped errors ---

export interface TtsClient {
  generate(config: TtsConfig): ResultAsync<AsyncIterable<Uint8Array>, TtsError>;
}

export type AnnotatorProvider = 'claude';

export interface TextAnnotator {
  annotate(text: string): ResultAsync<string, AnnotationError>;
  stream(text: string): ResultAsync<AsyncIterable<string>, AnnotationError>;
}
