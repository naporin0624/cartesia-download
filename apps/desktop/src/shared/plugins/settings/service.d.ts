export interface Preset {
  id: string;
  name: string;
  voiceId: string;
  systemPrompt: string;
}

export interface Settings {
  cartesiaApiKey: string;
  anthropicApiKey: string;
  model: string;
  sampleRate: number;
  language: string;
  annotate: boolean;
  presets: Preset[];
}

export interface SettingsService {
  get(): Settings;
  update(partial: Partial<Settings>): void;
  addPreset(preset: Preset): void;
  updatePreset(id: string, partial: Partial<Omit<Preset, 'id'>>): void;
  deletePreset(id: string): void;
}
