import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHistoryService } from './service';
import type { HistoryService } from '@shared/plugins/history/service';

const makeWav = (size = 64): ArrayBuffer => {
  const buf = new ArrayBuffer(size);
  new Uint8Array(buf).fill(42);
  return buf;
};

describe('HistoryService', () => {
  let audioDir: string;
  let service: HistoryService;

  beforeEach(() => {
    audioDir = mkdtempSync(join(tmpdir(), 'history-test-'));
    service = createHistoryService(audioDir);
  });

  afterEach(() => {
    rmSync(audioDir, { recursive: true, force: true });
  });

  it('list() returns empty array when no history', () => {
    expect(service.list()).toEqual([]);
  });

  it('add() returns HistoryEntry with generated id and createdAt', () => {
    const wav = makeWav();
    const entry = service.add(
      {
        text: 'Hello world',
        filePath: '',
        durationSec: 1.5,
        presetName: 'default',
      },
      wav,
    );

    expect(entry.id).toBeTruthy();
    expect(typeof entry.id).toBe('string');
    expect(entry.createdAt).toBeTruthy();
    expect(entry.text).toBe('Hello world');
    expect(entry.durationSec).toBe(1.5);
    expect(entry.presetName).toBe('default');
    expect(entry.filePath).toContain(entry.id);
    expect(entry.filePath).toContain('.wav');
  });

  it('add() persists WAV file to disk', () => {
    const wav = makeWav(128);
    const entry = service.add(
      {
        text: 'Test audio',
        filePath: '',
        durationSec: 2.0,
        presetName: 'test',
      },
      wav,
    );

    expect(existsSync(entry.filePath)).toBe(true);
  });

  it('list() returns entries sorted by createdAt desc', async () => {
    const wav = makeWav();

    service.add({ text: 'first', filePath: '', durationSec: 1, presetName: 'p' }, wav);
    await new Promise((resolve) => setTimeout(resolve, 10));
    service.add({ text: 'second', filePath: '', durationSec: 1, presetName: 'p' }, wav);
    await new Promise((resolve) => setTimeout(resolve, 10));
    service.add({ text: 'third', filePath: '', durationSec: 1, presetName: 'p' }, wav);

    const entries = service.list();
    expect(entries).toHaveLength(3);
    expect(entries[0].text).toBe('third');
    expect(entries[1].text).toBe('second');
    expect(entries[2].text).toBe('first');
  });

  it('remove() deletes entry and WAV file', () => {
    const wav = makeWav();
    const entry = service.add(
      {
        text: 'to remove',
        filePath: '',
        durationSec: 1,
        presetName: 'p',
      },
      wav,
    );

    expect(service.list()).toHaveLength(1);
    service.remove(entry.id);

    expect(service.list()).toHaveLength(0);
    expect(existsSync(entry.filePath)).toBe(false);
  });

  it('getAudio() returns WAV data for existing entry', () => {
    const wav = makeWav(256);
    const entry = service.add(
      {
        text: 'audio test',
        filePath: '',
        durationSec: 3,
        presetName: 'p',
      },
      wav,
    );

    const retrieved = service.getAudio(entry.id);
    expect(retrieved.byteLength).toBe(256);
    expect(new Uint8Array(retrieved)[0]).toBe(42);
  });

  it('getAudio() throws for non-existent entry', () => {
    expect(() => service.getAudio('non-existent-id')).toThrow();
  });

  it('data persists across service instances', () => {
    const wav = makeWav();
    const entry = service.add(
      {
        text: 'persistent',
        filePath: '',
        durationSec: 1,
        presetName: 'p',
      },
      wav,
    );

    const service2 = createHistoryService(audioDir);
    const entries = service2.list();

    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe(entry.id);
    expect(entries[0].text).toBe('persistent');
  });
});
