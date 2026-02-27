import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { getAnnotation, putAnnotation } from './annotation-cache';

const createInMemoryDb = () => {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
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
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
};

describe('getAnnotation', () => {
  it('returns undefined for a cache miss', () => {
    const { db, sqlite } = createInMemoryDb();

    const result = getAnnotation(db, 'some text', 'claude');
    expect(result).toBeUndefined();

    sqlite.close();
  });

  it('returns the annotated text after a put', () => {
    const { db, sqlite } = createInMemoryDb();

    putAnnotation(db, 'hello world', 'claude', '<emotion value="happy">hello world</emotion>');
    const result = getAnnotation(db, 'hello world', 'claude');
    expect(result).toBe('<emotion value="happy">hello world</emotion>');

    sqlite.close();
  });

  it('updates lastAccessedAt on cache hit', () => {
    const { db, sqlite } = createInMemoryDb();

    putAnnotation(db, 'hello', 'claude', '<emotion>hello</emotion>');

    const before = db.select().from(schema.annotationCache).all();
    const initialAccessedAt = before[0].lastAccessedAt;

    // Advance time slightly to ensure timestamp differs
    const start = Date.now();
    while (Date.now() <= start) {
      // spin until time advances
    }

    getAnnotation(db, 'hello', 'claude');

    const after = db.select().from(schema.annotationCache).all();
    expect(after[0].lastAccessedAt).toBeGreaterThan(initialAccessedAt);

    sqlite.close();
  });

  it('returns undefined for a different provider even if text matches', () => {
    const { db, sqlite } = createInMemoryDb();

    putAnnotation(db, 'hello', 'claude', '<emotion>hello</emotion>');
    const result = getAnnotation(db, 'hello', 'openai');
    expect(result).toBeUndefined();

    sqlite.close();
  });

  it('returns undefined for different text even if provider matches', () => {
    const { db, sqlite } = createInMemoryDb();

    putAnnotation(db, 'hello', 'claude', '<emotion>hello</emotion>');
    const result = getAnnotation(db, 'world', 'claude');
    expect(result).toBeUndefined();

    sqlite.close();
  });
});

describe('putAnnotation', () => {
  it('stores the annotated text in the DB', () => {
    const { db, sqlite } = createInMemoryDb();

    putAnnotation(db, 'test text', 'claude', '<emotion>test</emotion>');

    const rows = db.select().from(schema.annotationCache).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].annotatedText).toBe('<emotion>test</emotion>');

    sqlite.close();
  });

  it('overwrites existing entry with same text and provider (upsert)', () => {
    const { db, sqlite } = createInMemoryDb();

    putAnnotation(db, 'hello', 'claude', '<emotion>first</emotion>');
    putAnnotation(db, 'hello', 'claude', '<emotion>second</emotion>');

    const rows = db.select().from(schema.annotationCache).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].annotatedText).toBe('<emotion>second</emotion>');

    sqlite.close();
  });

  it('stores independent entries for the same text with different providers', () => {
    const { db, sqlite } = createInMemoryDb();

    putAnnotation(db, 'hello', 'claude', '<emotion>claude annotated</emotion>');
    putAnnotation(db, 'hello', 'openai', '<emotion>openai annotated</emotion>');

    const rows = db.select().from(schema.annotationCache).all();
    expect(rows).toHaveLength(2);

    sqlite.close();
  });

  it('stores independent entries for different texts with the same provider', () => {
    const { db, sqlite } = createInMemoryDb();

    putAnnotation(db, 'hello', 'claude', '<emotion>hello</emotion>');
    putAnnotation(db, 'world', 'claude', '<emotion>world</emotion>');

    const rows = db.select().from(schema.annotationCache).all();
    expect(rows).toHaveLength(2);

    sqlite.close();
  });

  it('lookups are independent per provider for same text', () => {
    const { db, sqlite } = createInMemoryDb();

    putAnnotation(db, 'hello', 'claude', '<emotion>claude annotated</emotion>');
    putAnnotation(db, 'hello', 'openai', '<emotion>openai annotated</emotion>');

    expect(getAnnotation(db, 'hello', 'claude')).toBe('<emotion>claude annotated</emotion>');
    expect(getAnnotation(db, 'hello', 'openai')).toBe('<emotion>openai annotated</emotion>');

    sqlite.close();
  });
});
