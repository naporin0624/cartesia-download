export interface BotConfig {
  discordToken: string;
  cartesiaApiKey: string;
  anthropicApiKey?: string;
  defaultVoiceId: string;
  defaultModel: string;
  defaultSampleRate: number;
  defaultLanguage: string;
  dbPath: string;
  cacheDirPath: string;
  cacheMaxBytes: number;
  cacheMaxEntries: number;
}

export const loadConfig = (env: Record<string, string | undefined>): BotConfig => {
  const discordToken = env['DISCORD_TOKEN'];
  if (!discordToken) throw new Error('DISCORD_TOKEN is required');

  const cartesiaApiKey = env['CARTESIA_API_KEY'];
  if (!cartesiaApiKey) throw new Error('CARTESIA_API_KEY is required');

  const defaultVoiceId = env['DEFAULT_VOICE_ID'];
  if (!defaultVoiceId) throw new Error('DEFAULT_VOICE_ID is required');

  return {
    discordToken,
    cartesiaApiKey,
    anthropicApiKey: env['ANTHROPIC_API_KEY'],
    defaultVoiceId,
    defaultModel: env['DEFAULT_MODEL'] ?? 'sonic-2',
    defaultSampleRate: Number(env['DEFAULT_SAMPLE_RATE'] ?? '44100'),
    defaultLanguage: env['DEFAULT_LANGUAGE'] ?? 'ja',
    dbPath: env['DB_PATH'] ?? './data/bot.db',
    cacheDirPath: env['CACHE_DIR'] ?? './data/cache',
    cacheMaxBytes: Number(env['CACHE_MAX_BYTES'] ?? String(500 * 1024 * 1024)),
    cacheMaxEntries: Number(env['CACHE_MAX_ENTRIES'] ?? '10000'),
  };
};
