export interface TtsOptions {
  voiceId: string;
  model: string;
  sampleRate: number;
  language: string;
  annotate: boolean;
  systemPrompt?: string;
  presetName: string;
}

export interface GenerateResult {
  wav: ArrayBuffer;
  annotatedText?: string;
}

export interface TtsService {
  generate(text: string, options: TtsOptions): Promise<GenerateResult>;
}
