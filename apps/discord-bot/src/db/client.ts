import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

type DbClient = {
  db: ReturnType<typeof drizzle<typeof schema>>;
  close: () => void;
};

export const createDbClient = (dbPath: string): DbClient => {
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema });
  const close = () => sqlite.close();
  return { db, close };
};
