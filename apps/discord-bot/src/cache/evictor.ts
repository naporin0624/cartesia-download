import { eq, asc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

type EvictLruOpts = {
  maxBytes: number;
  maxEntries: number;
};

type EvictLruResult = {
  evictedFiles: string[];
};

export const evictLru = (db: Db, opts: EvictLruOpts): EvictLruResult => {
  const rows = db.select().from(schema.audioCache).orderBy(asc(schema.audioCache.lastAccessedAt)).all();

  const totalBytes = rows.reduce((sum, row) => sum + row.fileSizeBytes, 0);
  const totalEntries = rows.length;

  const evictedFiles: string[] = [];
  let remainingBytes = totalBytes;
  let remainingEntries = totalEntries;

  for (const row of rows) {
    if (remainingBytes <= opts.maxBytes && remainingEntries <= opts.maxEntries) {
      break;
    }
    evictedFiles.push(row.filePath);
    db.delete(schema.audioCache).where(eq(schema.audioCache.id, row.id)).run();
    remainingBytes -= row.fileSizeBytes;
    remainingEntries -= 1;
  }

  return { evictedFiles };
};
