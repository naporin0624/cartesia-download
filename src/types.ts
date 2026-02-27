import type { ResultAsync } from 'neverthrow';

export interface ResolvedConfig {
  apiKey: string;
  voiceId: string;
  model: string;
  sampleRate: number;
  outputPath: string | undefined;
  text: string;
}

export interface RawCliArgs {
  input?: string;
  text?: string;
  'voice-id'?: string;
  output?: string;
  model?: string;
  'sample-rate'?: number;
  provider?: string;
  'provider-model'?: string;
  'provider-api-key'?: string;
  'no-annotate'?: boolean;
}

export interface RcConfig {
  apiKey?: string;
  voiceId?: string;
  model?: string;
  sampleRate?: number;
  outputPath?: string;
  provider?: string;
  providerModel?: string;
  providerApiKey?: string;
  noAnnotate?: boolean;
}

// --- Module-scoped error types ---

export type ConfigError = { type: 'MissingApiKey' } | { type: 'MissingVoiceId' } | { type: 'MissingText' };

export type IOError = { type: 'FileReadError'; path: string; cause: unknown } | { type: 'FileWriteError'; path: string; cause: unknown };

export type TtsError = { type: 'TtsApiError'; cause: unknown } | { type: 'TtsStreamError'; sentenceIndex: number; cause: unknown };

export type AnnotationError = { type: 'AnnotationError'; cause: unknown } | { type: 'UnsupportedProvider'; provider: string };

// App-level union for CLI boundary
export type AppError = ConfigError | IOError | TtsError | AnnotationError;

// --- Interfaces with module-scoped errors ---

export interface TtsClient {
  generate(config: ResolvedConfig): ResultAsync<AsyncIterable<Uint8Array>, TtsError>;
}

export type AnnotatorProvider = 'claude';

export interface TextAnnotator {
  annotate(text: string): ResultAsync<string, AnnotationError>;
}

// --- IO interface ---

export interface IO {
  readTextFile(path: string): ResultAsync<string, IOError>;
  readRcFile(path: string): ResultAsync<RcConfig, never>;
  writeFile(path: string, data: Buffer | string): ResultAsync<void, IOError>;
}
