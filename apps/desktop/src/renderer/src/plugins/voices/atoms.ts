import { atom } from 'jotai';
import { client } from '@renderer/adapters/client';

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

export const fetchVoicesAtom = atom(null, async (_get, set) => {
  set(voicesLoadingAtom, true);
  try {
    const res = await client.voices.$get();
    if (res.ok) {
      const data = (await res.json()) as VoiceEntry[];
      set(voicesAtom, data);
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
