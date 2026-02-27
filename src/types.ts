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

export interface TtsClient {
  generate(config: ResolvedConfig): Promise<TtsResult | CartesiaDownloadError>;
}

export interface FileOutput {
  write(path: string, result: TtsResult): Promise<void | CartesiaDownloadError>;
}

export type CartesiaDownloadError =
  | { type: 'MissingApiKey' }
  | { type: 'MissingVoiceId' }
  | { type: 'MissingText' }
  | { type: 'MissingOutput' }
  | { type: 'InvalidFormat'; value: string }
  | { type: 'FileReadError'; path: string; cause: unknown }
  | { type: 'TtsApiError'; cause: unknown }
  | { type: 'FileWriteError'; path: string; cause: unknown }
  | { type: 'AnnotationError'; cause: unknown }
  | { type: 'UnsupportedProvider'; provider: string };

export type AnnotatorProvider = 'claude';

export interface TextAnnotator {
  annotate(text: string): Promise<string | CartesiaDownloadError>;
}
