import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema';
import { addUtterance, getRecentUtterances } from './history';

const createInMemoryDb = () => {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS utterance_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      annotated_text TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
};

describe('addUtterance', () => {
  it('inserts a new utterance and returns its id', () => {
    const { db, sqlite } = createInMemoryDb();

    const result = addUtterance(db, { guildId: 'guild-123', userId: 'user-456', text: 'hello world' });
    expect(result).toBeDefined();
    expect(result.id).toBeTypeOf('number');
    expect(result.id).toBeGreaterThan(0);

    sqlite.close();
  });

  it('returns incrementing ids for multiple inserts', () => {
    const { db, sqlite } = createInMemoryDb();

    const first = addUtterance(db, { guildId: 'guild-123', userId: 'user-456', text: 'first' });
    const second = addUtterance(db, { guildId: 'guild-123', userId: 'user-456', text: 'second' });

    expect(second.id).toBeGreaterThan(first.id);

    sqlite.close();
  });

  it('stores annotatedText when provided', () => {
    const { db, sqlite } = createInMemoryDb();

    addUtterance(db, {
      guildId: 'guild-123',
      userId: 'user-456',
      text: 'hello',
      annotatedText: '<emotion value="excited">hello</emotion>',
    });

    const rows = db.select().from(schema.utteranceHistory).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].annotatedText).toBe('<emotion value="excited">hello</emotion>');

    sqlite.close();
  });

  it('stores null for annotatedText when not provided', () => {
    const { db, sqlite } = createInMemoryDb();

    addUtterance(db, { guildId: 'guild-123', userId: 'user-456', text: 'hello' });

    const rows = db.select().from(schema.utteranceHistory).all();
    expect(rows[0].annotatedText).toBeNull();

    sqlite.close();
  });

  it('stores the correct guildId, userId, and text', () => {
    const { db, sqlite } = createInMemoryDb();

    addUtterance(db, { guildId: 'guild-abc', userId: 'user-xyz', text: 'test utterance' });

    const rows = db.select().from(schema.utteranceHistory).all();
    expect(rows[0].guildId).toBe('guild-abc');
    expect(rows[0].userId).toBe('user-xyz');
    expect(rows[0].text).toBe('test utterance');

    sqlite.close();
  });
});

describe('getRecentUtterances', () => {
  it('returns empty array when no history exists for a guild', () => {
    const { db, sqlite } = createInMemoryDb();

    const result = getRecentUtterances(db, 'guild-no-history');
    expect(result).toEqual([]);

    sqlite.close();
  });

  it('returns utterances only for the specified guild', () => {
    const { db, sqlite } = createInMemoryDb();

    addUtterance(db, { guildId: 'guild-a', userId: 'user-1', text: 'guild a utterance' });
    addUtterance(db, { guildId: 'guild-b', userId: 'user-2', text: 'guild b utterance' });

    const result = getRecentUtterances(db, 'guild-a');
    expect(result).toHaveLength(1);
    expect(result[0].guildId).toBe('guild-a');

    sqlite.close();
  });

  it('returns utterances in reverse chronological order (most recent first)', () => {
    const { db, sqlite } = createInMemoryDb();

    addUtterance(db, { guildId: 'guild-123', userId: 'user-1', text: 'first' });
    addUtterance(db, { guildId: 'guild-123', userId: 'user-1', text: 'second' });
    addUtterance(db, { guildId: 'guild-123', userId: 'user-1', text: 'third' });

    const result = getRecentUtterances(db, 'guild-123');
    expect(result[0].text).toBe('third');
    expect(result[1].text).toBe('second');
    expect(result[2].text).toBe('first');

    sqlite.close();
  });

  it('respects the limit parameter', () => {
    const { db, sqlite } = createInMemoryDb();

    addUtterance(db, { guildId: 'guild-123', userId: 'user-1', text: 'first' });
    addUtterance(db, { guildId: 'guild-123', userId: 'user-1', text: 'second' });
    addUtterance(db, { guildId: 'guild-123', userId: 'user-1', text: 'third' });

    const result = getRecentUtterances(db, 'guild-123', 2);
    expect(result).toHaveLength(2);

    sqlite.close();
  });

  it('returns the most recent utterances when limit is applied', () => {
    const { db, sqlite } = createInMemoryDb();

    addUtterance(db, { guildId: 'guild-123', userId: 'user-1', text: 'oldest' });
    addUtterance(db, { guildId: 'guild-123', userId: 'user-1', text: 'middle' });
    addUtterance(db, { guildId: 'guild-123', userId: 'user-1', text: 'newest' });

    const result = getRecentUtterances(db, 'guild-123', 2);
    expect(result[0].text).toBe('newest');
    expect(result[1].text).toBe('middle');

    sqlite.close();
  });

  it('returns all utterances when limit is not specified', () => {
    const { db, sqlite } = createInMemoryDb();

    addUtterance(db, { guildId: 'guild-123', userId: 'user-1', text: 'first' });
    addUtterance(db, { guildId: 'guild-123', userId: 'user-1', text: 'second' });
    addUtterance(db, { guildId: 'guild-123', userId: 'user-1', text: 'third' });
    addUtterance(db, { guildId: 'guild-123', userId: 'user-1', text: 'fourth' });

    const result = getRecentUtterances(db, 'guild-123');
    expect(result).toHaveLength(4);

    sqlite.close();
  });

  it('returns full utterance objects with all fields', () => {
    const { db, sqlite } = createInMemoryDb();

    addUtterance(db, {
      guildId: 'guild-123',
      userId: 'user-456',
      text: 'test text',
      annotatedText: '<emotion>annotated</emotion>',
    });

    const result = getRecentUtterances(db, 'guild-123');
    expect(result[0].id).toBeTypeOf('number');
    expect(result[0].guildId).toBe('guild-123');
    expect(result[0].userId).toBe('user-456');
    expect(result[0].text).toBe('test text');
    expect(result[0].annotatedText).toBe('<emotion>annotated</emotion>');
    expect(result[0].createdAt).toBeTypeOf('number');

    sqlite.close();
  });
});
