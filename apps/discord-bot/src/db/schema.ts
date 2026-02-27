import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core';

export const guildSettings = sqliteTable('guild_settings', {
  guildId: text('guild_id').primaryKey().notNull(),
  voiceId: text('voice_id').notNull(),
  language: text('language').notNull().default('ja'),
  annotationEnabled: integer('annotation_enabled').notNull().default(1),
  model: text('model').notNull().default('sonic-2'),
  sampleRate: integer('sample_rate').notNull().default(44100),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const utteranceHistory = sqliteTable('utterance_history', {
  id: integer('id').primaryKey({ autoIncrement: true }).notNull(),
  guildId: text('guild_id').notNull(),
  userId: text('user_id').notNull(),
  text: text('text').notNull(),
  annotatedText: text('annotated_text'),
  createdAt: integer('created_at').notNull(),
});

export const audioCache = sqliteTable('audio_cache', {
  id: integer('id').primaryKey({ autoIncrement: true }).notNull(),
  contentHash: text('content_hash').notNull().unique(),
  filePath: text('file_path').notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  lastAccessedAt: integer('last_accessed_at').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const annotationCache = sqliteTable(
  'annotation_cache',
  {
    id: integer('id').primaryKey({ autoIncrement: true }).notNull(),
    textHash: text('text_hash').notNull(),
    provider: text('provider').notNull(),
    annotatedText: text('annotated_text').notNull(),
    lastAccessedAt: integer('last_accessed_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [unique().on(table.textHash, table.provider)],
);
