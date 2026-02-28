import { mkdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { HistoryEntry, HistoryService } from '@shared/plugins/history/service';

const HISTORY_FILE = 'history.json';

const readEntries = (audioDir: string): HistoryEntry[] => {
  const historyPath = join(audioDir, HISTORY_FILE);
  if (!existsSync(historyPath)) {
    return [];
  }
  const raw = readFileSync(historyPath, 'utf-8');
  return JSON.parse(raw) as HistoryEntry[];
};

const writeEntries = (audioDir: string, entries: HistoryEntry[]): void => {
  const historyPath = join(audioDir, HISTORY_FILE);
  writeFileSync(historyPath, JSON.stringify(entries, null, 2), 'utf-8');
};

export const createHistoryService = (audioDir: string): HistoryService => {
  mkdirSync(audioDir, { recursive: true });

  return {
    list: (): HistoryEntry[] => {
      const entries = readEntries(audioDir);
      return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    add: (entry: Omit<HistoryEntry, 'id' | 'createdAt'>, wav: ArrayBuffer): HistoryEntry => {
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const filePath = join(audioDir, `${id}.wav`);

      writeFileSync(filePath, Buffer.from(wav));

      const newEntry: HistoryEntry = {
        ...entry,
        id,
        createdAt,
        filePath,
      };

      const entries = readEntries(audioDir);
      writeEntries(audioDir, [...entries, newEntry]);

      return newEntry;
    },

    remove: (id: string): void => {
      const entries = readEntries(audioDir);
      const target = entries.find((e) => e.id === id);

      if (target && existsSync(target.filePath)) {
        unlinkSync(target.filePath);
      }

      writeEntries(
        audioDir,
        entries.filter((e) => e.id !== id),
      );
    },

    getAudio: (id: string): ArrayBuffer => {
      const entries = readEntries(audioDir);
      const target = entries.find((e) => e.id === id);

      if (!target) {
        throw new Error(`HistoryEntry not found: ${id}`);
      }

      const buf = readFileSync(target.filePath);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    },
  };
};
