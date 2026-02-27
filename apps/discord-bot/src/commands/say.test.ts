import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok } from 'neverthrow';
import type { BotConfig } from '../config';
import type { TtsClient, TextAnnotator } from '@cartesia-download/core';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema';
import { handleSay } from './say';

type MockConnectionManager = {
  join: ReturnType<typeof vi.fn>;
  leave: ReturnType<typeof vi.fn>;
  getConnection: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

vi.mock('../cache/annotation-cache', () => ({
  getAnnotation: vi.fn(),
  putAnnotation: vi.fn(),
}));

vi.mock('../cache/audio-cache', () => ({
  getAudioPath: vi.fn(),
  putAudio: vi.fn(),
}));

vi.mock('../db/repos/guild-settings', () => ({
  getGuildSettings: vi.fn(),
}));

vi.mock('../db/repos/history', () => ({
  addUtterance: vi.fn().mockReturnValue({ id: 1 }),
}));

vi.mock('../voice/audio-pipeline', () => ({
  createAudioStream: vi.fn().mockReturnValue({ readable: 'stream' }),
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 1024 }),
}));

import { getAnnotation, putAnnotation } from '../cache/annotation-cache';
import { getAudioPath, putAudio } from '../cache/audio-cache';
import { getGuildSettings } from '../db/repos/guild-settings';
import { addUtterance } from '../db/repos/history';
import { playAudio } from '../voice/audio-pipeline';

type Db = BetterSQLite3Database<typeof schema>;

const defaultConfig: BotConfig = {
  discordToken: 'token',
  cartesiaApiKey: 'cartesia-key',
  anthropicApiKey: 'anthropic-key',
  defaultVoiceId: 'default-voice-id',
  defaultModel: 'sonic-2',
  defaultSampleRate: 44100,
  defaultLanguage: 'ja',
  dbPath: './data/bot.db',
  cacheDirPath: './data/cache',
  cacheMaxBytes: 500 * 1024 * 1024,
  cacheMaxEntries: 10000,
};

const defaultGuildSettings = {
  guildId: 'guild-123',
  voiceId: 'guild-voice-id',
  language: 'ja',
  annotationEnabled: 1,
  model: 'sonic-2',
  sampleRate: 44100,
  createdAt: 1000,
  updatedAt: 1000,
};

// eslint-disable-next-line func-style -- async generators require function* syntax
async function* makeAudioChunks(): AsyncIterable<Uint8Array> {
  yield new Uint8Array([1, 2, 3]);
}

type MockInteractionOverrides = {
  guildId?: string;
  text?: string;
  userId?: string;
};

const createMockInteraction = (overrides?: MockInteractionOverrides) => ({
  guildId: overrides?.guildId ?? 'guild-123',
  member: {
    voice: { channel: { id: 'channel-456' } },
    user: { id: overrides?.userId ?? 'user-789' },
  },
  guild: {
    voiceAdapterCreator: vi.fn(),
  },
  options: {
    getString: vi.fn().mockReturnValue(overrides?.text ?? 'hello world'),
  },
  reply: vi.fn().mockResolvedValue(undefined),
  deferReply: vi.fn().mockResolvedValue(undefined),
  editReply: vi.fn().mockResolvedValue(undefined),
});

const createMockDb = (): Db => ({}) as unknown as Db;

const createMockConnectionManager = (): MockConnectionManager => {
  const fakeConnection = { subscribe: vi.fn(), destroy: vi.fn() };
  return {
    join: vi.fn().mockReturnValue(fakeConnection),
    leave: vi.fn().mockReturnValue(true),
    getConnection: vi.fn().mockReturnValue(fakeConnection),
    destroy: vi.fn(),
  };
};

const createMockTtsClient = (): TtsClient => ({
  generate: vi.fn().mockReturnValue(ok(makeAudioChunks())),
});

const createMockAnnotator = (annotatedText = '<emotion value="happy">hello world</emotion>'): TextAnnotator => ({
  annotate: vi.fn().mockReturnValue(ok(annotatedText)),
  stream: vi.fn().mockReturnValue(
    ok(
      (async function* () {
        yield annotatedText;
      })(),
    ),
  ),
});

describe('handleSay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getGuildSettings as ReturnType<typeof vi.fn>).mockReturnValue(defaultGuildSettings);
    (getAnnotation as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    (getAudioPath as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
  });

  it('defers the reply before processing', async () => {
    const connectionManager = createMockConnectionManager();
    const db = createMockDb();
    const ttsClient = createMockTtsClient();
    const interaction = createMockInteraction();

    await handleSay({ connectionManager, db, config: defaultConfig, ttsClient, cacheDirPath: '/cache' }, interaction as unknown as Parameters<typeof handleSay>[1]);

    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
  });

  it('edits the reply with completion message after processing', async () => {
    const connectionManager = createMockConnectionManager();
    const db = createMockDb();
    const ttsClient = createMockTtsClient();
    const interaction = createMockInteraction();

    await handleSay({ connectionManager, db, config: defaultConfig, ttsClient, cacheDirPath: '/cache' }, interaction as unknown as Parameters<typeof handleSay>[1]);

    expect(interaction.editReply).toHaveBeenCalledTimes(1);
    const editArg = (interaction.editReply as ReturnType<typeof vi.fn>).mock.calls[0][0] as { content: string };
    expect(editArg.content).toEqual(expect.any(String));
    expect(editArg.content.length).toBeGreaterThan(0);
  });

  it('uses cached annotation when available and skips annotator call', async () => {
    const connectionManager = createMockConnectionManager();
    const db = createMockDb();
    const ttsClient = createMockTtsClient();
    const annotator = createMockAnnotator();
    const cachedAnnotation = '<emotion value="sad">hello world</emotion>';
    (getAnnotation as ReturnType<typeof vi.fn>).mockReturnValue(cachedAnnotation);
    const interaction = createMockInteraction({ text: 'hello world' });

    await handleSay({ connectionManager, db, config: defaultConfig, ttsClient, annotator, cacheDirPath: '/cache' }, interaction as unknown as Parameters<typeof handleSay>[1]);

    expect(annotator.annotate).not.toHaveBeenCalled();
    expect(annotator.stream).not.toHaveBeenCalled();
  });

  it('calls annotator when annotation cache misses', async () => {
    const connectionManager = createMockConnectionManager();
    const db = createMockDb();
    const ttsClient = createMockTtsClient();
    const annotator = createMockAnnotator();
    (getAnnotation as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const interaction = createMockInteraction({ text: 'hello world' });

    await handleSay({ connectionManager, db, config: defaultConfig, ttsClient, annotator, cacheDirPath: '/cache' }, interaction as unknown as Parameters<typeof handleSay>[1]);

    expect(annotator.annotate).toHaveBeenCalled();
  });

  it('stores annotation in cache after a cache miss', async () => {
    const connectionManager = createMockConnectionManager();
    const db = createMockDb();
    const ttsClient = createMockTtsClient();
    const annotatedText = '<emotion value="happy">hello world</emotion>';
    const annotator = createMockAnnotator(annotatedText);
    (getAnnotation as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const interaction = createMockInteraction({ text: 'hello world' });

    await handleSay({ connectionManager, db, config: defaultConfig, ttsClient, annotator, cacheDirPath: '/cache' }, interaction as unknown as Parameters<typeof handleSay>[1]);

    expect(putAnnotation).toHaveBeenCalledWith(db, 'hello world', expect.any(String), annotatedText);
  });

  it('uses cached audio path when audio cache hits and skips TTS generation', async () => {
    const connectionManager = createMockConnectionManager();
    const db = createMockDb();
    const ttsClient = createMockTtsClient();
    const cachedAudioPath = '/cache/abc123.pcm';
    (getAudioPath as ReturnType<typeof vi.fn>).mockReturnValue(cachedAudioPath);
    const interaction = createMockInteraction({ text: 'hello world' });

    await handleSay({ connectionManager, db, config: defaultConfig, ttsClient, cacheDirPath: '/cache' }, interaction as unknown as Parameters<typeof handleSay>[1]);

    expect(ttsClient.generate).not.toHaveBeenCalled();
  });

  it('generates TTS and plays audio when audio cache misses', async () => {
    const connectionManager = createMockConnectionManager();
    const db = createMockDb();
    const ttsClient = createMockTtsClient();
    (getAudioPath as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const interaction = createMockInteraction({ text: 'hello world' });

    await handleSay({ connectionManager, db, config: defaultConfig, ttsClient, cacheDirPath: '/cache' }, interaction as unknown as Parameters<typeof handleSay>[1]);

    expect(ttsClient.generate).toHaveBeenCalled();
    expect(playAudio).toHaveBeenCalled();
  });

  it('stores audio in cache after TTS generation', async () => {
    const connectionManager = createMockConnectionManager();
    const db = createMockDb();
    const ttsClient = createMockTtsClient();
    (getAudioPath as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const interaction = createMockInteraction({ text: 'hello world' });

    await handleSay({ connectionManager, db, config: defaultConfig, ttsClient, cacheDirPath: '/cache' }, interaction as unknown as Parameters<typeof handleSay>[1]);

    expect(putAudio).toHaveBeenCalled();
  });

  it('records the utterance in history', async () => {
    const connectionManager = createMockConnectionManager();
    const db = createMockDb();
    const ttsClient = createMockTtsClient();
    const interaction = createMockInteraction({ text: 'hello world', userId: 'user-789' });

    await handleSay({ connectionManager, db, config: defaultConfig, ttsClient, cacheDirPath: '/cache' }, interaction as unknown as Parameters<typeof handleSay>[1]);

    expect(addUtterance).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        guildId: 'guild-123',
        userId: 'user-789',
        text: 'hello world',
      }),
    );
  });

  it('works without annotator (no-annotate mode) and still plays audio', async () => {
    const connectionManager = createMockConnectionManager();
    const db = createMockDb();
    const ttsClient = createMockTtsClient();
    const interaction = createMockInteraction({ text: 'hello world' });

    await handleSay({ connectionManager, db, config: defaultConfig, ttsClient, cacheDirPath: '/cache' }, interaction as unknown as Parameters<typeof handleSay>[1]);

    expect(ttsClient.generate).toHaveBeenCalled();
    expect(playAudio).toHaveBeenCalled();
  });
});
