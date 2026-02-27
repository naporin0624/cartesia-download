import type { ResultAsync } from 'neverthrow';

export type AudioFormat = 'wav' | 'mp3';

export interface ResolvedConfig {
  apiKey: string;
  voiceId: string;
  model: string;
  sampleRate: number;
  format: AudioFormat;
  outputPath: string;
  text: string;
}

export interface RawCliArgs {
  input?: string;
  text?: string;
  'voice-id'?: string;
  format?: string;
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
  format?: string;
  outputPath?: string;
  provider?: string;
  providerModel?: string;
  providerApiKey?: string;
  noAnnotate?: boolean;
}

export interface TtsResult {
  audioData: ArrayBuffer;
  format: AudioFormat;
}

// --- Module-scoped error types ---

export type ConfigError = { type: 'MissingApiKey' } | { type: 'MissingVoiceId' } | { type: 'MissingText' } | { type: 'MissingOutput' } | { type: 'InvalidFormat'; value: string };

export type IOError = { type: 'FileReadError'; path: string; cause: unknown } | { type: 'FileWriteError'; path: string; cause: unknown };

export type TtsError = { type: 'TtsApiError'; cause: unknown };

export type AnnotationError = { type: 'AnnotationError'; cause: unknown } | { type: 'UnsupportedProvider'; provider: string };

// App-level union for CLI boundary
export type AppError = ConfigError | IOError | TtsError | AnnotationError;

// --- Interfaces with module-scoped errors ---

export interface TtsClient {
  generate(config: ResolvedConfig): ResultAsync<TtsResult, TtsError>;
}

export interface FileOutput {
  write(path: string, result: TtsResult): ResultAsync<void, IOError>;
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
