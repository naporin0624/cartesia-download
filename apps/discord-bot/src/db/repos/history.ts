import { eq, desc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { utteranceHistory } from '../schema';
import type * as schema from '../schema';

type Db = BetterSQLite3Database<typeof schema>;

type UtteranceRow = typeof utteranceHistory.$inferSelect;

type AddUtteranceParams = {
  guildId: string;
  userId: string;
  text: string;
  annotatedText?: string | null;
};

export const addUtterance = (db: Db, params: AddUtteranceParams): { id: number } => {
  const now = Date.now();
  const result = db
    .insert(utteranceHistory)
    .values({
      guildId: params.guildId,
      userId: params.userId,
      text: params.text,
      annotatedText: params.annotatedText ?? null,
      createdAt: now,
    })
    .returning({ id: utteranceHistory.id })
    .get();

  return { id: result.id };
};

export const getRecentUtterances = (db: Db, guildId: string, limit?: number): UtteranceRow[] => {
  const query = db.select().from(utteranceHistory).where(eq(utteranceHistory.guildId, guildId)).orderBy(desc(utteranceHistory.createdAt), desc(utteranceHistory.id));

  if (limit !== undefined) {
    return query.limit(limit).all();
  }

  return query.all();
};
