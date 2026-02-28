import { atom } from 'jotai';
import { client } from '@renderer/adapters/client';

export interface Preset {
  id: string;
  name: string;
  voiceId: string;
  systemPrompt: string;
}

interface Settings {
  cartesiaApiKey: string;
  anthropicApiKey: string;
  model: string;
  sampleRate: number;
  language: string;
  annotate: boolean;
  presets: Preset[];
}

const defaultSettings: Settings = {
  cartesiaApiKey: '',
  anthropicApiKey: '',
  model: 'sonic-3',
  sampleRate: 44100,
  language: 'ja',
  annotate: false,
  presets: [],
};

export const settingsAtom = atom<Settings>(defaultSettings);

export const fetchSettingsAtom = atom(null, async (_get, set) => {
  const res = await client.settings.$get();
  if (res.ok) {
    const data = await res.json();
    set(settingsAtom, data as Settings);
  }
});

export const updateSettingsAtom = atom(null, async (get, set, partial: Partial<Settings>) => {
  const current = get(settingsAtom);
  const updated = { ...current, ...partial };
  set(settingsAtom, updated);

  await client.settings.$put({
    json: partial,
  });
});

export const addPresetAtom = atom(null, async (get, set, preset: Omit<Preset, 'id'>) => {
  const res = await client.settings.presets.$post({
    json: preset,
  });

  if (res.ok) {
    const { id } = (await res.json()) as { id: string };
    const current = get(settingsAtom);
    set(settingsAtom, { ...current, presets: [...current.presets, { id, ...preset }] });
  }
});

export const updatePresetAtom = atom(null, async (get, set, id: string, partial: Partial<Omit<Preset, 'id'>>) => {
  await client.settings.presets[':id'].$put({
    param: { id },
    json: partial,
  });

  const current = get(settingsAtom);
  set(settingsAtom, {
    ...current,
    presets: current.presets.map((p) => (p.id === id ? { ...p, ...partial } : p)),
  });
});

export const deletePresetAtom = atom(null, async (get, set, id: string) => {
  await client.settings.presets[':id'].$delete({
    param: { id },
  });

  const current = get(settingsAtom);
  set(settingsAtom, {
    ...current,
    presets: current.presets.filter((p) => p.id !== id),
  });
});
