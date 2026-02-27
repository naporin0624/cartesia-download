import { eq, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { computeHash } from './hash';

type Db = BetterSQLite3Database<typeof schema>;

export const getAnnotation = (db: Db, text: string, provider: string): string | undefined => {
  const textHash = computeHash(text);
  const rows = db
    .select()
    .from(schema.annotationCache)
    .where(and(eq(schema.annotationCache.textHash, textHash), eq(schema.annotationCache.provider, provider)))
    .all();
  if (rows.length === 0) {
    return undefined;
  }
  const row = rows[0];
  db.update(schema.annotationCache).set({ lastAccessedAt: Date.now() }).where(eq(schema.annotationCache.id, row.id)).run();
  return row.annotatedText;
};

export const putAnnotation = (db: Db, text: string, provider: string, annotatedText: string): void => {
  const textHash = computeHash(text);
  const now = Date.now();
  db.insert(schema.annotationCache)
    .values({ textHash, provider, annotatedText, lastAccessedAt: now, createdAt: now })
    .onConflictDoUpdate({
      target: [schema.annotationCache.textHash, schema.annotationCache.provider],
      set: { annotatedText, lastAccessedAt: now },
    })
    .run();
};
