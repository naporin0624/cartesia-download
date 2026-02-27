import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { getAudioPath, putAudio } from './audio-cache';

const createInMemoryDb = () => {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS audio_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      content_hash TEXT NOT NULL UNIQUE,
      file_path TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      last_accessed_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
};

describe('getAudioPath', () => {
  it('returns undefined for a cache miss', () => {
    const { db, sqlite } = createInMemoryDb();

    const result = getAudioPath(db, 'nonexistent-hash');
    expect(result).toBeUndefined();

    sqlite.close();
  });

  it('returns the file path after a put', () => {
    const { db, sqlite } = createInMemoryDb();

    putAudio(db, 'cache-key-abc', '/tmp/audio.wav', 2048);
    const result = getAudioPath(db, 'cache-key-abc');
    expect(result).toBe('/tmp/audio.wav');

    sqlite.close();
  });

  it('returns undefined for a different cache key even if file exists', () => {
    const { db, sqlite } = createInMemoryDb();

    putAudio(db, 'cache-key-abc', '/tmp/audio.wav', 2048);
    const result = getAudioPath(db, 'cache-key-xyz');
    expect(result).toBeUndefined();

    sqlite.close();
  });

  it('updates lastAccessedAt on cache hit', () => {
    const { db, sqlite } = createInMemoryDb();

    putAudio(db, 'cache-key-abc', '/tmp/audio.wav', 2048);

    const before = db.select().from(schema.audioCache).all();
    const initialAccessedAt = before[0].lastAccessedAt;

    // Advance time slightly to ensure timestamp differs
    const start = Date.now();
    while (Date.now() <= start) {
      // spin until time advances
    }

    getAudioPath(db, 'cache-key-abc');

    const after = db.select().from(schema.audioCache).all();
    expect(after[0].lastAccessedAt).toBeGreaterThan(initialAccessedAt);

    sqlite.close();
  });
});

describe('putAudio', () => {
  it('stores the audio entry in the DB', () => {
    const { db, sqlite } = createInMemoryDb();

    putAudio(db, 'hash-abc', '/tmp/audio.wav', 1024);

    const rows = db.select().from(schema.audioCache).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].contentHash).toBe('hash-abc');
    expect(rows[0].filePath).toBe('/tmp/audio.wav');
    expect(rows[0].fileSizeBytes).toBe(1024);

    sqlite.close();
  });

  it('overwrites existing entry with same cacheKey (upsert)', () => {
    const { db, sqlite } = createInMemoryDb();

    putAudio(db, 'hash-abc', '/tmp/audio-v1.wav', 1024);
    putAudio(db, 'hash-abc', '/tmp/audio-v2.wav', 2048);

    const rows = db.select().from(schema.audioCache).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].filePath).toBe('/tmp/audio-v2.wav');
    expect(rows[0].fileSizeBytes).toBe(2048);

    sqlite.close();
  });

  it('stores multiple entries for different cacheKeys', () => {
    const { db, sqlite } = createInMemoryDb();

    putAudio(db, 'hash-aaa', '/tmp/audio-a.wav', 1024);
    putAudio(db, 'hash-bbb', '/tmp/audio-b.wav', 2048);

    const rows = db.select().from(schema.audioCache).all();
    expect(rows).toHaveLength(2);

    sqlite.close();
  });

  it('sets createdAt and lastAccessedAt on insert', () => {
    const { db, sqlite } = createInMemoryDb();

    const before = Date.now();
    putAudio(db, 'hash-abc', '/tmp/audio.wav', 1024);
    const after = Date.now();

    const rows = db.select().from(schema.audioCache).all();
    expect(rows[0].createdAt).toBeGreaterThanOrEqual(before);
    expect(rows[0].createdAt).toBeLessThanOrEqual(after);
    expect(rows[0].lastAccessedAt).toBeGreaterThanOrEqual(before);
    expect(rows[0].lastAccessedAt).toBeLessThanOrEqual(after);

    sqlite.close();
  });
});
