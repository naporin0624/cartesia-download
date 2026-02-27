import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema';
import { getGuildSettings, upsertGuildSettings } from './guild-settings';

const createInMemoryDb = () => {
  const sqlite = new Database(':memory:');
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
  `);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
};

describe('getGuildSettings', () => {
  it('returns undefined for a non-existent guild', () => {
    const { db, sqlite } = createInMemoryDb();

    const result = getGuildSettings(db, 'guild-does-not-exist');
    expect(result).toBeUndefined();

    sqlite.close();
  });

  it('returns guild settings for an existing guild', () => {
    const { db, sqlite } = createInMemoryDb();
    const now = Date.now();

    db.insert(schema.guildSettings)
      .values({
        guildId: 'guild-123',
        voiceId: 'voice-abc',
        language: 'en',
        annotationEnabled: 1,
        model: 'sonic-2',
        sampleRate: 44100,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const result = getGuildSettings(db, 'guild-123');
    expect(result).toBeDefined();
    expect(result?.guildId).toBe('guild-123');
    expect(result?.voiceId).toBe('voice-abc');

    sqlite.close();
  });
});

describe('upsertGuildSettings', () => {
  it('creates new settings for a guild that does not exist', () => {
    const { db, sqlite } = createInMemoryDb();

    const result = upsertGuildSettings(db, 'guild-new', { voiceId: 'voice-xyz' });
    expect(result).toBeDefined();
    expect(result.guildId).toBe('guild-new');
    expect(result.voiceId).toBe('voice-xyz');

    sqlite.close();
  });

  it('new settings have default language value of "ja"', () => {
    const { db, sqlite } = createInMemoryDb();

    const result = upsertGuildSettings(db, 'guild-defaults', { voiceId: 'voice-xyz' });
    expect(result.language).toBe('ja');

    sqlite.close();
  });

  it('new settings have default model value of "sonic-2"', () => {
    const { db, sqlite } = createInMemoryDb();

    const result = upsertGuildSettings(db, 'guild-defaults', { voiceId: 'voice-xyz' });
    expect(result.model).toBe('sonic-2');

    sqlite.close();
  });

  it('new settings have default sampleRate value of 44100', () => {
    const { db, sqlite } = createInMemoryDb();

    const result = upsertGuildSettings(db, 'guild-defaults', { voiceId: 'voice-xyz' });
    expect(result.sampleRate).toBe(44100);

    sqlite.close();
  });

  it('new settings have default annotationEnabled value of 1', () => {
    const { db, sqlite } = createInMemoryDb();

    const result = upsertGuildSettings(db, 'guild-defaults', { voiceId: 'voice-xyz' });
    expect(result.annotationEnabled).toBe(1);

    sqlite.close();
  });

  it('updates existing settings with new values', () => {
    const { db, sqlite } = createInMemoryDb();

    upsertGuildSettings(db, 'guild-123', { voiceId: 'voice-original', language: 'ja' });
    const updated = upsertGuildSettings(db, 'guild-123', { voiceId: 'voice-updated' });

    expect(updated.guildId).toBe('guild-123');
    expect(updated.voiceId).toBe('voice-updated');

    sqlite.close();
  });

  it('preserves unmodified fields when updating', () => {
    const { db, sqlite } = createInMemoryDb();

    upsertGuildSettings(db, 'guild-123', { voiceId: 'voice-abc', language: 'en', sampleRate: 22050 });
    const updated = upsertGuildSettings(db, 'guild-123', { voiceId: 'voice-new' });

    expect(updated.language).toBe('en');
    expect(updated.sampleRate).toBe(22050);

    sqlite.close();
  });

  it('returns the updated settings after update', () => {
    const { db, sqlite } = createInMemoryDb();

    upsertGuildSettings(db, 'guild-123', { voiceId: 'voice-first' });
    const result = upsertGuildSettings(db, 'guild-123', { voiceId: 'voice-second', model: 'sonic-3' });

    expect(result.voiceId).toBe('voice-second');
    expect(result.model).toBe('sonic-3');

    sqlite.close();
  });

  it('can update annotationEnabled to disabled (0)', () => {
    const { db, sqlite } = createInMemoryDb();

    upsertGuildSettings(db, 'guild-123', { voiceId: 'voice-abc', annotationEnabled: 1 });
    const updated = upsertGuildSettings(db, 'guild-123', { annotationEnabled: 0 });

    expect(updated.annotationEnabled).toBe(0);

    sqlite.close();
  });

  it('updates updatedAt timestamp on update', () => {
    const { db, sqlite } = createInMemoryDb();

    const first = upsertGuildSettings(db, 'guild-123', { voiceId: 'voice-abc' });
    const second = upsertGuildSettings(db, 'guild-123', { voiceId: 'voice-xyz' });

    expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);

    sqlite.close();
  });
});
