import { atom } from 'jotai';
import { client } from '@renderer/adapters/client';
import type { HistoryEntry } from '@shared/plugins/history/service';

export const historyAtom = atom<HistoryEntry[]>([]);
export const playingIdAtom = atom<string | null>(null);

export const fetchHistoryAtom = atom(null, async (_get, set) => {
  const res = await client.history.$get();
  const data = await res.json();
  if ('error' in data) return;
  set(historyAtom, data as HistoryEntry[]);
});

export const deleteHistoryAtom = atom(null, async (get, set, id: string) => {
  await client.history[':id'].$delete({ param: { id } });
  const current = get(historyAtom);
  set(
    historyAtom,
    current.filter((e) => e.id !== id),
  );

  if (get(playingIdAtom) === id) {
    set(playingIdAtom, null);
  }
});

let audioInstance: HTMLAudioElement | null = null;
let currentBlobUrl: string | null = null;

const cleanup = (): void => {
  if (audioInstance) {
    audioInstance.pause();
    audioInstance.src = '';
    audioInstance = null;
  }
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = null;
  }
};

export const downloadHistoryAtom = atom(null, async (_get, _set, id: string) => {
  const res = await client.history[':id'].audio.$get({ param: { id } });
  const data = await res.json();
  if ('error' in data) return;

  const wavBase64 = (data as { wav: string }).wav;
  await window.electron.ipcRenderer.invoke('save-wav-dialog', wavBase64);
});

export const togglePlayAtom = atom(null, async (get, set, id: string) => {
  const currentId = get(playingIdAtom);

  if (currentId === id) {
    cleanup();
    set(playingIdAtom, null);
    return;
  }

  cleanup();

  const res = await client.history[':id'].audio.$get({ param: { id } });
  const data = await res.json();
  if ('error' in data) return;

  const binaryStr = atob((data as { wav: string }).wav);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: 'audio/wav' });
  currentBlobUrl = URL.createObjectURL(blob);

  audioInstance = new Audio(currentBlobUrl);
  audioInstance.addEventListener('ended', () => {
    set(playingIdAtom, null);
    cleanup();
  });

  set(playingIdAtom, id);
  await audioInstance.play();
});
