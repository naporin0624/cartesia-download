import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';
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

// --- voices list (async, cached, refreshable) ---

const voicesVersionAtom = atom(0);

export const voicesAtom = atom(async (get) => {
  get(voicesVersionAtom);
  const res = await client.voices.$get();
  if (!res.ok) throw new Error('Failed to fetch voices');
  return (await res.json()) as VoiceEntry[];
});

export const refreshVoicesAtom = atom(null, (_get, set) => {
  set(voicesVersionAtom, (c) => c + 1);
});

// --- selection ---

export const selectedVoiceIdAtom = atom<string | null>(null);
export const voicesExpandedAtom = atom(false);

// --- per-voice edit form (atomFamily: sync, no suspend) ---

const originalFormFamily = atomFamily((_id: string) => atom<VoiceEditForm>({ name: '', description: '', isPublic: false }));

const editFormFamily = atomFamily((_id: string) => atom<VoiceEditForm>({ name: '', description: '', isPublic: false }));

export const selectedOriginalFormAtom = atom((get) => {
  const id = get(selectedVoiceIdAtom);
  return id ? get(originalFormFamily(id)) : null;
});

export const selectedEditFormAtom = atom((get) => {
  const id = get(selectedVoiceIdAtom);
  return id ? get(editFormFamily(id)) : null;
});

export const isDirtyAtom = atom((get) => {
  const id = get(selectedVoiceIdAtom);
  if (!id) return false;
  const original = get(originalFormFamily(id));
  const form = get(editFormFamily(id));
  return form.name !== original.name || form.description !== original.description || form.isPublic !== original.isPublic;
});

// --- actions ---

export const selectVoiceAtom = atom(null, async (get, set, id: string) => {
  set(selectedVoiceIdAtom, id);
  const voices = await get(voicesAtom);
  const voice = voices.find((v) => v.id === id);
  if (voice) {
    const formData: VoiceEditForm = { name: voice.name, description: voice.description, isPublic: voice.isPublic };
    set(originalFormFamily(id), formData);
    set(editFormFamily(id), formData);
  }
});

export const updateEditFormAtom = atom(null, (get, set, partial: Partial<VoiceEditForm>) => {
  const id = get(selectedVoiceIdAtom);
  if (!id) return;
  set(editFormFamily(id), (prev) => ({ ...prev, ...partial }));
});

export const updateVoiceAtom = atom(null, async (get, set) => {
  const id = get(selectedVoiceIdAtom);
  if (!id) return;
  const form = get(editFormFamily(id));

  await client.voices[':id'].$patch({
    param: { id },
    json: form,
  });

  set(originalFormFamily(id), form);
  set(voicesVersionAtom, (c) => c + 1);
});
