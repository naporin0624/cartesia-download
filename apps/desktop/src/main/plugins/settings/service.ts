import Store from 'electron-store';
import type { Settings, SettingsService } from '@shared/plugins/settings/service';

const defaults: Settings = {
  cartesiaApiKey: '',
  anthropicApiKey: '',
  model: 'sonic-3',
  sampleRate: 44100,
  language: 'ja',
  annotate: false,
  presets: [],
};

export const createSettingsService = (): SettingsService => {
  const store = new Store<Settings>({ defaults });

  return {
    get: () => store.store,
    update: (partial) => {
      for (const [key, value] of Object.entries(partial)) {
        if (value !== undefined) {
          store.set(key as keyof Settings, value);
        }
      }
    },
    addPreset: (preset) => {
      const presets = store.get('presets');
      store.set('presets', [...presets, preset]);
    },
    updatePreset: (id, partial) => {
      const presets = store.get('presets');
      store.set(
        'presets',
        presets.map((p) => (p.id === id ? { ...p, ...partial } : p)),
      );
    },
    deletePreset: (id) => {
      const presets = store.get('presets');
      store.set(
        'presets',
        presets.filter((p) => p.id !== id),
      );
    },
  };
};
