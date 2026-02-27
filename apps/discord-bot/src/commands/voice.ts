import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema';
import { upsertGuildSettings } from '../db/repos/guild-settings';

type Db = BetterSQLite3Database<typeof schema>;

type VoiceDeps = {
  db: Db;
};

type VoiceInteraction = {
  guildId: string;
  options: {
    getString: (name: string) => string | null;
  };
  reply: (options: { content: string; ephemeral?: boolean }) => Promise<unknown>;
};

export const handleVoice = async (deps: VoiceDeps, interaction: VoiceInteraction): Promise<void> => {
  const { db } = deps;
  const voiceId = interaction.options.getString('voice_id') ?? interaction.options.getString('voiceId') ?? '';

  upsertGuildSettings(db, interaction.guildId, { voiceId });

  await interaction.reply({ content: `Voice ID set to: ${voiceId}` });
};
