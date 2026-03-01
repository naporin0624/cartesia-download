import { atom } from 'jotai';
import { client } from '@renderer/adapters/client';
import { settingsAtom } from '@renderer/plugins/settings/atoms';

export interface VoiceEntry {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  language: string;
  createdAt: string;
}

interface VoiceEditForm {
  name: string;
  description: string;
  isPublic: boolean;
}

export const voicesAtom = atom<VoiceEntry[]>([]);
export const voicesLoadingAtom = atom(false);
export const selectedVoiceIdAtom = atom<string | null>(null);
export const voicesExpandedAtom = atom(false);
export const editFormAtom = atom<VoiceEditForm | null>(null);

export const isDirtyAtom = atom((get) => {
  const form = get(editFormAtom);
  const selectedId = get(selectedVoiceIdAtom);
  const voices = get(voicesAtom);
  if (!form || !selectedId) return false;

  const original = voices.find((v) => v.id === selectedId);
  if (!original) return false;

  return form.name !== original.name || form.description !== original.description || form.isPublic !== original.isPublic;
});

export const fetchVoicesAtom = atom(null, async (get, set) => {
  set(voicesLoadingAtom, true);
  try {
    const res = await client.voices.$get();
    if (!res.ok) return;

    const data = (await res.json()) as VoiceEntry[];
    set(voicesAtom, data);

    const settings = get(settingsAtom);
    const existingVoiceIds = new Set(settings.presets.map((p) => p.voiceId));
    const missing = data.filter((v) => !existingVoiceIds.has(v.id));

    for (const voice of missing) {
      const addRes = await client.settings.presets.$post({ json: { name: voice.name, voiceId: voice.id, systemPrompt: '' } });
      if (addRes.ok) {
        const { id } = (await addRes.json()) as { id: string };
        set(settingsAtom, (prev) => ({ ...prev, presets: [...prev.presets, { id, name: voice.name, voiceId: voice.id, systemPrompt: '' }] }));
      }
    }
  } finally {
    set(voicesLoadingAtom, false);
  }
});

export const selectVoiceAtom = atom(null, (get, set, id: string) => {
  set(selectedVoiceIdAtom, id);
  const voices = get(voicesAtom);
  const voice = voices.find((v) => v.id === id);
  if (voice) {
    set(editFormAtom, { name: voice.name, description: voice.description, isPublic: voice.isPublic });
  }
});

export const updateEditFormAtom = atom(null, (_get, set, partial: Partial<VoiceEditForm>) => {
  set(editFormAtom, (prev) => (prev ? { ...prev, ...partial } : null));
});

export const updateVoiceAtom = atom(null, async (get, set) => {
  const selectedId = get(selectedVoiceIdAtom);
  const form = get(editFormAtom);
  if (!selectedId || !form) return;

  set(voicesAtom, (prev) => prev.map((v) => (v.id === selectedId ? { ...v, ...form } : v)));

  await client.voices[':id'].$patch({
    param: { id: selectedId },
    json: form,
  });
});
