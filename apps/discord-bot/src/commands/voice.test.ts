import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema';
import { handleVoice } from './voice';

vi.mock('../db/repos/guild-settings', () => ({
  upsertGuildSettings: vi.fn(),
}));

import { upsertGuildSettings } from '../db/repos/guild-settings';

type Db = BetterSQLite3Database<typeof schema>;

const createMockDb = (): Db => ({}) as unknown as Db;

type MockInteractionOverrides = {
  guildId?: string;
  voiceId?: string;
};

const createMockInteraction = (overrides?: MockInteractionOverrides) => ({
  guildId: overrides?.guildId ?? 'guild-123',
  member: {
    voice: { channel: { id: 'channel-456' } },
    user: { id: 'user-789' },
  },
  guild: {
    voiceAdapterCreator: vi.fn(),
  },
  options: {
    getString: vi.fn().mockReturnValue(overrides?.voiceId ?? 'new-voice-id'),
  },
  reply: vi.fn().mockResolvedValue(undefined),
  deferReply: vi.fn().mockResolvedValue(undefined),
  editReply: vi.fn().mockResolvedValue(undefined),
});

describe('handleVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (upsertGuildSettings as ReturnType<typeof vi.fn>).mockReturnValue({
      guildId: 'guild-123',
      voiceId: 'new-voice-id',
      language: 'ja',
      annotationEnabled: 1,
      model: 'sonic-2',
      sampleRate: 44100,
      createdAt: 1000,
      updatedAt: 2000,
    });
  });

  it('calls upsertGuildSettings with the provided voiceId', async () => {
    const db = createMockDb();
    const interaction = createMockInteraction({ guildId: 'guild-abc', voiceId: 'my-voice-id' });

    await handleVoice({ db }, interaction as unknown as Parameters<typeof handleVoice>[1]);

    expect(upsertGuildSettings).toHaveBeenCalledWith(db, 'guild-abc', expect.objectContaining({ voiceId: 'my-voice-id' }));
  });

  it('replies with a confirmation message after setting voiceId', async () => {
    const db = createMockDb();
    const interaction = createMockInteraction({ voiceId: 'cool-voice-id' });

    await handleVoice({ db }, interaction as unknown as Parameters<typeof handleVoice>[1]);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const replyArg = (interaction.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as { content: string };
    expect(replyArg.content).toEqual(expect.any(String));
    expect(replyArg.content.length).toBeGreaterThan(0);
  });

  it('reads the voiceId from interaction options', async () => {
    const db = createMockDb();
    const interaction = createMockInteraction({ voiceId: 'another-voice-id' });

    await handleVoice({ db }, interaction as unknown as Parameters<typeof handleVoice>[1]);

    expect(interaction.options.getString).toHaveBeenCalled();
  });

  it('passes the guildId from the interaction to upsertGuildSettings', async () => {
    const db = createMockDb();
    const interaction = createMockInteraction({ guildId: 'specific-guild', voiceId: 'some-voice' });

    await handleVoice({ db }, interaction as unknown as Parameters<typeof handleVoice>[1]);

    const callArgs = (upsertGuildSettings as ReturnType<typeof vi.fn>).mock.calls[0] as [Db, string, unknown];
    expect(callArgs[1]).toBe('specific-guild');
  });
});
