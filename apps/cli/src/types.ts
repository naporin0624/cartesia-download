import type { ResultAsync } from 'neverthrow';
import type { TtsConfig, CoreError } from '@cartesia-download/core';

export interface ResolvedConfig extends TtsConfig {
  outputPath: string | undefined;
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

// App-level union for CLI boundary
export type AppError = CoreError | ConfigError | IOError;

// --- IO interface ---

export interface IO {
  readTextFile(path: string): ResultAsync<string, IOError>;
  readRcFile(path: string): ResultAsync<RcConfig, never>;
  writeFile(path: string, data: Buffer | string): ResultAsync<void, IOError>;
}
