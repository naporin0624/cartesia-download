import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { evictLru } from './evictor';

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

const insertAudioEntry = (db: ReturnType<typeof drizzle>, contentHash: string, filePath: string, fileSizeBytes: number, lastAccessedAt: number) => {
  const now = Date.now();
  db.insert(schema.audioCache).values({ contentHash, filePath, fileSizeBytes, lastAccessedAt, createdAt: now }).run();
};

describe('evictLru', () => {
  it('returns empty array when cache is within both limits', () => {
    const { db, sqlite } = createInMemoryDb();

    insertAudioEntry(db, 'hash-a', '/tmp/a.wav', 500, Date.now() - 3000);
    insertAudioEntry(db, 'hash-b', '/tmp/b.wav', 500, Date.now() - 2000);

    const result = evictLru(db, { maxBytes: 10000, maxEntries: 100 });
    expect(result.evictedFiles).toEqual([]);

    sqlite.close();
  });

  it('returns empty array when cache is empty', () => {
    const { db, sqlite } = createInMemoryDb();

    const result = evictLru(db, { maxBytes: 1000, maxEntries: 10 });
    expect(result.evictedFiles).toEqual([]);

    sqlite.close();
  });

  it('evicts the oldest entry first when maxEntries is exceeded', () => {
    const { db, sqlite } = createInMemoryDb();

    const now = Date.now();
    insertAudioEntry(db, 'hash-oldest', '/tmp/oldest.wav', 100, now - 3000);
    insertAudioEntry(db, 'hash-middle', '/tmp/middle.wav', 100, now - 2000);
    insertAudioEntry(db, 'hash-newest', '/tmp/newest.wav', 100, now - 1000);

    // maxEntries=2 means we need to evict 1 entry (the oldest)
    const result = evictLru(db, { maxBytes: 1000000, maxEntries: 2 });
    expect(result.evictedFiles).toContain('/tmp/oldest.wav');
    expect(result.evictedFiles).not.toContain('/tmp/newest.wav');

    sqlite.close();
  });

  it('evicts enough entries to satisfy maxEntries constraint', () => {
    const { db, sqlite } = createInMemoryDb();

    const now = Date.now();
    insertAudioEntry(db, 'hash-1', '/tmp/1.wav', 100, now - 5000);
    insertAudioEntry(db, 'hash-2', '/tmp/2.wav', 100, now - 4000);
    insertAudioEntry(db, 'hash-3', '/tmp/3.wav', 100, now - 3000);
    insertAudioEntry(db, 'hash-4', '/tmp/4.wav', 100, now - 2000);
    insertAudioEntry(db, 'hash-5', '/tmp/5.wav', 100, now - 1000);

    // maxEntries=2 means we need to evict 3 entries
    const result = evictLru(db, { maxBytes: 1000000, maxEntries: 2 });
    expect(result.evictedFiles).toHaveLength(3);
    expect(result.evictedFiles).toContain('/tmp/1.wav');
    expect(result.evictedFiles).toContain('/tmp/2.wav');
    expect(result.evictedFiles).toContain('/tmp/3.wav');

    sqlite.close();
  });

  it('evicts entries when maxBytes is exceeded', () => {
    const { db, sqlite } = createInMemoryDb();

    const now = Date.now();
    insertAudioEntry(db, 'hash-oldest', '/tmp/oldest.wav', 600, now - 3000);
    insertAudioEntry(db, 'hash-middle', '/tmp/middle.wav', 600, now - 2000);
    insertAudioEntry(db, 'hash-newest', '/tmp/newest.wav', 600, now - 1000);

    // total = 1800 bytes, maxBytes = 1000, must evict oldest until under limit
    const result = evictLru(db, { maxBytes: 1000, maxEntries: 1000 });
    expect(result.evictedFiles.length).toBeGreaterThan(0);
    expect(result.evictedFiles).toContain('/tmp/oldest.wav');

    sqlite.close();
  });

  it('evicts enough to bring total bytes under maxBytes', () => {
    const { db, sqlite } = createInMemoryDb();

    const now = Date.now();
    insertAudioEntry(db, 'hash-1', '/tmp/1.wav', 400, now - 4000);
    insertAudioEntry(db, 'hash-2', '/tmp/2.wav', 400, now - 3000);
    insertAudioEntry(db, 'hash-3', '/tmp/3.wav', 400, now - 2000);
    insertAudioEntry(db, 'hash-4', '/tmp/4.wav', 400, now - 1000);

    // total = 1600 bytes, maxBytes = 800, need to evict at least 2
    const result = evictLru(db, { maxBytes: 800, maxEntries: 1000 });
    expect(result.evictedFiles).toHaveLength(2);
    expect(result.evictedFiles).toContain('/tmp/1.wav');
    expect(result.evictedFiles).toContain('/tmp/2.wav');

    sqlite.close();
  });

  it('removes evicted entries from the DB', () => {
    const { db, sqlite } = createInMemoryDb();

    const now = Date.now();
    insertAudioEntry(db, 'hash-oldest', '/tmp/oldest.wav', 100, now - 2000);
    insertAudioEntry(db, 'hash-newest', '/tmp/newest.wav', 100, now - 1000);

    evictLru(db, { maxBytes: 1000000, maxEntries: 1 });

    const remaining = db.select().from(schema.audioCache).all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].contentHash).toBe('hash-newest');

    sqlite.close();
  });

  it('returns file paths so caller can delete from disk', () => {
    const { db, sqlite } = createInMemoryDb();

    const now = Date.now();
    insertAudioEntry(db, 'hash-a', '/data/audio/a.wav', 100, now - 2000);
    insertAudioEntry(db, 'hash-b', '/data/audio/b.wav', 100, now - 1000);

    const result = evictLru(db, { maxBytes: 1000000, maxEntries: 1 });
    expect(result.evictedFiles).toEqual(['/data/audio/a.wav']);

    sqlite.close();
  });

  it('evicts by both constraints simultaneously, applying stricter one', () => {
    const { db, sqlite } = createInMemoryDb();

    const now = Date.now();
    insertAudioEntry(db, 'hash-1', '/tmp/1.wav', 600, now - 4000);
    insertAudioEntry(db, 'hash-2', '/tmp/2.wav', 600, now - 3000);
    insertAudioEntry(db, 'hash-3', '/tmp/3.wav', 600, now - 2000);
    insertAudioEntry(db, 'hash-4', '/tmp/4.wav', 600, now - 1000);

    // maxBytes=1200 (keeps 2), maxEntries=3 (keeps 3) → stricter is maxBytes, evict 2
    const result = evictLru(db, { maxBytes: 1200, maxEntries: 3 });
    expect(result.evictedFiles).toHaveLength(2);
    expect(result.evictedFiles).toContain('/tmp/1.wav');
    expect(result.evictedFiles).toContain('/tmp/2.wav');

    sqlite.close();
  });
});
