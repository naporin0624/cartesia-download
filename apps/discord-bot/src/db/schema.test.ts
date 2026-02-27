import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { guildSettings, utteranceHistory, audioCache, annotationCache } from './schema';

const createInMemoryDb = () => {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY NOT NULL,
      voice_id TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'ja',
      annotation_enabled INTEGER NOT NULL DEFAULT 1,
      model TEXT NOT NULL DEFAULT 'sonic-2',
      sample_rate INTEGER NOT NULL DEFAULT 44100,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS utterance_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      annotated_text TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audio_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      content_hash TEXT NOT NULL UNIQUE,
      file_path TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      last_accessed_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS annotation_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      text_hash TEXT NOT NULL,
      provider TEXT NOT NULL,
      annotated_text TEXT NOT NULL,
      last_accessed_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(text_hash, provider)
    );
  `);
  return { db, sqlite };
};

describe('schema', () => {
  describe('guild_settings table', () => {
    it('exports guildSettings table definition', () => {
      expect(guildSettings).toBeDefined();
    });

    it('can insert and retrieve a guild_settings row', () => {
      const { db, sqlite } = createInMemoryDb();
      const now = Date.now();

      db.insert(guildSettings)
        .values({
          guildId: 'guild-123',
          voiceId: 'voice-abc',
          language: 'ja',
          annotationEnabled: 1,
          model: 'sonic-2',
          sampleRate: 44100,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(guildSettings).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].guildId).toBe('guild-123');
      expect(rows[0].voiceId).toBe('voice-abc');

      sqlite.close();
    });

    it('has correct default values for language', () => {
      const { sqlite } = createInMemoryDb();
      const now = Date.now();

      sqlite
        .prepare(`
        INSERT INTO guild_settings (guild_id, voice_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `)
        .run('guild-defaults', 'voice-xyz', now, now);

      const row = sqlite.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get('guild-defaults') as Record<string, unknown>;
      expect(row.language).toBe('ja');

      sqlite.close();
    });

    it('has correct default value for annotation_enabled (1 = true)', () => {
      const { sqlite } = createInMemoryDb();
      const now = Date.now();

      sqlite
        .prepare(`
        INSERT INTO guild_settings (guild_id, voice_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `)
        .run('guild-defaults', 'voice-xyz', now, now);

      const row = sqlite.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get('guild-defaults') as Record<string, unknown>;
      expect(row.annotation_enabled).toBe(1);

      sqlite.close();
    });

    it('has correct default value for model (sonic-2)', () => {
      const { sqlite } = createInMemoryDb();
      const now = Date.now();

      sqlite
        .prepare(`
        INSERT INTO guild_settings (guild_id, voice_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `)
        .run('guild-defaults', 'voice-xyz', now, now);

      const row = sqlite.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get('guild-defaults') as Record<string, unknown>;
      expect(row.model).toBe('sonic-2');

      sqlite.close();
    });

    it('has correct default value for sample_rate (44100)', () => {
      const { sqlite } = createInMemoryDb();
      const now = Date.now();

      sqlite
        .prepare(`
        INSERT INTO guild_settings (guild_id, voice_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `)
        .run('guild-defaults', 'voice-xyz', now, now);

      const row = sqlite.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get('guild-defaults') as Record<string, unknown>;
      expect(row.sample_rate).toBe(44100);

      sqlite.close();
    });
  });

  describe('utterance_history table', () => {
    it('exports utteranceHistory table definition', () => {
      expect(utteranceHistory).toBeDefined();
    });

    it('can insert and retrieve an utterance_history row', () => {
      const { db, sqlite } = createInMemoryDb();
      const now = Date.now();

      db.insert(utteranceHistory)
        .values({
          guildId: 'guild-123',
          userId: 'user-456',
          text: 'hello world',
          createdAt: now,
        })
        .run();

      const rows = db.select().from(utteranceHistory).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].text).toBe('hello world');
      expect(rows[0].annotatedText).toBeNull();

      sqlite.close();
    });

    it('allows nullable annotatedText', () => {
      const { db, sqlite } = createInMemoryDb();
      const now = Date.now();

      db.insert(utteranceHistory)
        .values({
          guildId: 'guild-123',
          userId: 'user-456',
          text: 'hello',
          annotatedText: null,
          createdAt: now,
        })
        .run();

      const rows = db.select().from(utteranceHistory).all();
      expect(rows[0].annotatedText).toBeNull();

      sqlite.close();
    });

    it('stores annotatedText when provided', () => {
      const { db, sqlite } = createInMemoryDb();
      const now = Date.now();

      db.insert(utteranceHistory)
        .values({
          guildId: 'guild-123',
          userId: 'user-456',
          text: 'hello',
          annotatedText: '<emotion>hello</emotion>',
          createdAt: now,
        })
        .run();

      const rows = db.select().from(utteranceHistory).all();
      expect(rows[0].annotatedText).toBe('<emotion>hello</emotion>');

      sqlite.close();
    });
  });

  describe('audio_cache table', () => {
    it('exports audioCache table definition', () => {
      expect(audioCache).toBeDefined();
    });

    it('can insert and retrieve an audio_cache row', () => {
      const { db, sqlite } = createInMemoryDb();
      const now = Date.now();

      db.insert(audioCache)
        .values({
          contentHash: 'abc123',
          filePath: '/tmp/audio.wav',
          fileSizeBytes: 1024,
          lastAccessedAt: now,
          createdAt: now,
        })
        .run();

      const rows = db.select().from(audioCache).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].contentHash).toBe('abc123');
      expect(rows[0].filePath).toBe('/tmp/audio.wav');

      sqlite.close();
    });

    it('enforces unique constraint on contentHash', () => {
      const { db, sqlite } = createInMemoryDb();
      const now = Date.now();

      db.insert(audioCache)
        .values({
          contentHash: 'duplicate-hash',
          filePath: '/tmp/audio1.wav',
          fileSizeBytes: 1024,
          lastAccessedAt: now,
          createdAt: now,
        })
        .run();

      expect(() => {
        db.insert(audioCache)
          .values({
            contentHash: 'duplicate-hash',
            filePath: '/tmp/audio2.wav',
            fileSizeBytes: 2048,
            lastAccessedAt: now,
            createdAt: now,
          })
          .run();
      }).toThrow();

      sqlite.close();
    });
  });

  describe('annotation_cache table', () => {
    it('exports annotationCache table definition', () => {
      expect(annotationCache).toBeDefined();
    });

    it('can insert and retrieve an annotation_cache row', () => {
      const { db, sqlite } = createInMemoryDb();
      const now = Date.now();

      db.insert(annotationCache)
        .values({
          textHash: 'hash-abc',
          provider: 'claude',
          annotatedText: '<emotion>annotated</emotion>',
          lastAccessedAt: now,
          createdAt: now,
        })
        .run();

      const rows = db.select().from(annotationCache).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].textHash).toBe('hash-abc');
      expect(rows[0].provider).toBe('claude');

      sqlite.close();
    });

    it('enforces unique constraint on (textHash, provider) composite', () => {
      const { db, sqlite } = createInMemoryDb();
      const now = Date.now();

      db.insert(annotationCache)
        .values({
          textHash: 'hash-xyz',
          provider: 'claude',
          annotatedText: '<emotion>first</emotion>',
          lastAccessedAt: now,
          createdAt: now,
        })
        .run();

      expect(() => {
        db.insert(annotationCache)
          .values({
            textHash: 'hash-xyz',
            provider: 'claude',
            annotatedText: '<emotion>second</emotion>',
            lastAccessedAt: now,
            createdAt: now,
          })
          .run();
      }).toThrow();

      sqlite.close();
    });

    it('allows same textHash with different provider', () => {
      const { db, sqlite } = createInMemoryDb();
      const now = Date.now();

      db.insert(annotationCache)
        .values({
          textHash: 'hash-xyz',
          provider: 'claude',
          annotatedText: '<emotion>claude annotated</emotion>',
          lastAccessedAt: now,
          createdAt: now,
        })
        .run();

      expect(() => {
        db.insert(annotationCache)
          .values({
            textHash: 'hash-xyz',
            provider: 'openai',
            annotatedText: '<emotion>openai annotated</emotion>',
            lastAccessedAt: now,
            createdAt: now,
          })
          .run();
      }).not.toThrow();

      const rows = db.select().from(annotationCache).all();
      expect(rows).toHaveLength(2);

      sqlite.close();
    });
  });
});
