import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

export const getAudioPath = (db: Db, cacheKey: string): string | undefined => {
  const rows = db.select().from(schema.audioCache).where(eq(schema.audioCache.contentHash, cacheKey)).all();
  if (rows.length === 0) {
    return undefined;
  }
  const row = rows[0];
  db.update(schema.audioCache).set({ lastAccessedAt: Date.now() }).where(eq(schema.audioCache.id, row.id)).run();
  return row.filePath;
};

export const putAudio = (db: Db, cacheKey: string, filePath: string, fileSizeBytes: number): void => {
  const now = Date.now();
  db.insert(schema.audioCache)
    .values({ contentHash: cacheKey, filePath, fileSizeBytes, lastAccessedAt: now, createdAt: now })
    .onConflictDoUpdate({
      target: schema.audioCache.contentHash,
      set: { filePath, fileSizeBytes, lastAccessedAt: now },
    })
    .run();
};
