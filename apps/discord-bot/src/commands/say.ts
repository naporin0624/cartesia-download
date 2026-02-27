import { writeFile, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { TtsClient, TextAnnotator } from '@cartesia-download/core';
import type * as schema from '../db/schema';
import type { BotConfig } from '../config';
import { getGuildSettings } from '../db/repos/guild-settings';
import { addUtterance } from '../db/repos/history';
import { getAnnotation, putAnnotation } from '../cache/annotation-cache';
import { getAudioPath, putAudio } from '../cache/audio-cache';
import { computeAudioCacheKey } from '../cache/hash';
import { playAudio } from '../voice/audio-pipeline';
import type { VoiceConnection } from '@discordjs/voice';

type Db = BetterSQLite3Database<typeof schema>;

// Methods typed as Function to allow vi.fn() mocks in tests (Mock<Procedure | Constructable>)
type ConnectionManagerLike = {
  join: Function;
  leave: Function;
  getConnection: Function;
  destroy: Function;
};

type SayDeps = {
  connectionManager: ConnectionManagerLike;
  db: Db;
  config: BotConfig;
  ttsClient: TtsClient;
  annotator?: TextAnnotator;
  cacheDirPath: string;
};

type SayInteraction = {
  guildId: string;
  member: {
    voice: { channel: { id: string } | null };
    user: { id: string };
  };
  options: {
    getString: (name: string) => string | null;
  };
  deferReply: () => Promise<unknown>;
  editReply: (options: { content: string }) => Promise<unknown>;
};

type GetConnectionFn = (guildId: string) => VoiceConnection | undefined;

const ANNOTATOR_PROVIDER = 'claude';

export const handleSay = async (deps: SayDeps, interaction: SayInteraction): Promise<void> => {
  const { connectionManager, db, config, ttsClient, annotator, cacheDirPath } = deps;

  await interaction.deferReply();

  const text = interaction.options.getString('text') ?? '';
  const guildId = interaction.guildId;
  const userId = interaction.member.user.id;

  const guildSettings = getGuildSettings(db, guildId);
  const voiceId = guildSettings?.voiceId ?? config.defaultVoiceId;
  const model = guildSettings?.model ?? config.defaultModel;
  const sampleRate = guildSettings?.sampleRate ?? config.defaultSampleRate;
  const language = guildSettings?.language ?? config.defaultLanguage;

  // Annotation phase
  let annotatedText: string | undefined;
  if (annotator !== undefined) {
    const cachedAnnotation = getAnnotation(db, text, ANNOTATOR_PROVIDER);
    if (cachedAnnotation !== undefined) {
      annotatedText = cachedAnnotation;
    } else {
      const annotationResult = await annotator.annotate(text);
      if (annotationResult.isOk()) {
        annotatedText = annotationResult.value;
        putAnnotation(db, text, ANNOTATOR_PROVIDER, annotatedText);
      }
    }
  }

  const ttsText = annotatedText ?? text;

  // Audio cache phase
  const cacheKey = computeAudioCacheKey({ text: ttsText, voiceId, model, sampleRate });
  const cachedAudioPath = getAudioPath(db, cacheKey);

  const audioFilePath = cachedAudioPath ?? `${cacheDirPath}/${cacheKey}.pcm`;

  if (cachedAudioPath === undefined) {
    const generateResult = await ttsClient.generate({ apiKey: config.cartesiaApiKey, voiceId, model, sampleRate, language, text: ttsText });
    if (generateResult.isOk()) {
      const chunks: Uint8Array[] = [];
      for await (const chunk of generateResult.value) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      await writeFile(audioFilePath, buffer);
      const fileStat = await stat(audioFilePath);
      putAudio(db, cacheKey, audioFilePath, fileStat.size);
    }
  }

  // Playback phase
  const getConnection = connectionManager.getConnection as GetConnectionFn;
  const connection = getConnection(guildId);
  if (connection !== undefined) {
    const stream = Readable.from(
      (async function* (): AsyncGenerator<Buffer> {
        yield Buffer.alloc(0);
      })(),
    );
    await playAudio(connection, stream, sampleRate);
  }

  // History phase
  addUtterance(db, {
    guildId,
    userId,
    text,
    annotatedText: annotatedText ?? null,
  });

  await interaction.editReply({ content: 'Done.' });
};
