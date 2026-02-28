export interface HistoryEntry {
  id: string;
  text: string;
  filePath: string;
  durationSec: number;
  presetName: string;
  createdAt: string;
}

export interface HistoryService {
  list(): HistoryEntry[];
  add(entry: Omit<HistoryEntry, 'id' | 'createdAt'>, wav: ArrayBuffer): HistoryEntry;
  remove(id: string): void;
  getAudio(id: string): ArrayBuffer;
}
