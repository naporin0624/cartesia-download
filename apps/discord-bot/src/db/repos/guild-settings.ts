import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { guildSettings } from '../schema';
import type * as schema from '../schema';

type Db = BetterSQLite3Database<typeof schema>;

type GuildSettingsRow = typeof guildSettings.$inferSelect;

type GuildSettingsUpdate = {
  voiceId?: string;
  language?: string;
  annotationEnabled?: number;
  model?: string;
  sampleRate?: number;
};

export const getGuildSettings = (db: Db, guildId: string): GuildSettingsRow | undefined => {
  const rows = db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).all();
  return rows[0];
};

export const upsertGuildSettings = (db: Db, guildId: string, settings: GuildSettingsUpdate): GuildSettingsRow => {
  const now = Date.now();
  const existing = getGuildSettings(db, guildId);

  if (existing === undefined) {
    db.insert(guildSettings)
      .values({
        guildId,
        voiceId: settings.voiceId ?? '',
        language: settings.language ?? 'ja',
        annotationEnabled: settings.annotationEnabled ?? 1,
        model: settings.model ?? 'sonic-2',
        sampleRate: settings.sampleRate ?? 44100,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  } else {
    db.update(guildSettings)
      .set({
        ...(settings.voiceId !== undefined ? { voiceId: settings.voiceId } : {}),
        ...(settings.language !== undefined ? { language: settings.language } : {}),
        ...(settings.annotationEnabled !== undefined ? { annotationEnabled: settings.annotationEnabled } : {}),
        ...(settings.model !== undefined ? { model: settings.model } : {}),
        ...(settings.sampleRate !== undefined ? { sampleRate: settings.sampleRate } : {}),
        updatedAt: now,
      })
      .where(eq(guildSettings.guildId, guildId))
      .run();
  }

  const result = getGuildSettings(db, guildId);
  if (result === undefined) {
    throw new Error(`Failed to upsert guild settings for guildId: ${guildId}`);
  }
  return result;
};
