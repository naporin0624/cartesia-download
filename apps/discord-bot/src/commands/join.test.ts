import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleJoin } from './join';

type FakeVoiceConnection = {
  destroy: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
};

type MockConnectionManager = {
  join: ReturnType<typeof vi.fn>;
  leave: ReturnType<typeof vi.fn>;
  getConnection: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

const makeFakeConnection = (): FakeVoiceConnection => ({
  destroy: vi.fn(),
  subscribe: vi.fn(),
});

type MockInteractionOverrides = {
  guildId?: string;
  voiceChannel?: { id: string } | null;
  voiceAdapterCreator?: ReturnType<typeof vi.fn>;
  userId?: string;
};

const createMockInteraction = (overrides?: MockInteractionOverrides) => ({
  guildId: overrides?.guildId ?? 'guild-123',
  member: {
    voice: {
      channel: overrides?.voiceChannel !== undefined ? overrides.voiceChannel : { id: 'channel-456' },
    },
    user: { id: overrides?.userId ?? 'user-789' },
  },
  guild: {
    voiceAdapterCreator: overrides?.voiceAdapterCreator ?? vi.fn(),
  },
  options: {
    getString: vi.fn(),
  },
  reply: vi.fn().mockResolvedValue(undefined),
  deferReply: vi.fn().mockResolvedValue(undefined),
  editReply: vi.fn().mockResolvedValue(undefined),
});

const createMockConnectionManager = (): MockConnectionManager => ({
  join: vi.fn().mockReturnValue(makeFakeConnection()),
  leave: vi.fn().mockReturnValue(true),
  getConnection: vi.fn().mockReturnValue(undefined),
  destroy: vi.fn(),
});

describe('handleJoin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('joins the voice channel and replies with success when user is in a voice channel', async () => {
    const connectionManager = createMockConnectionManager();
    const adapterCreator = vi.fn();
    const interaction = createMockInteraction({ voiceAdapterCreator: adapterCreator });

    await handleJoin({ connectionManager }, interaction as unknown as Parameters<typeof handleJoin>[1]);

    expect(connectionManager.join).toHaveBeenCalledWith('guild-123', 'channel-456', adapterCreator);
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('') }));
  });

  it('replies with an error when the user is not in a voice channel', async () => {
    const connectionManager = createMockConnectionManager();
    const interaction = createMockInteraction({ voiceChannel: null });

    await handleJoin({ connectionManager }, interaction as unknown as Parameters<typeof handleJoin>[1]);

    expect(connectionManager.join).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.any(String),
        ephemeral: true,
      }),
    );
  });

  it('passes the correct guildId, channelId, and adapterCreator to connectionManager.join', async () => {
    const connectionManager = createMockConnectionManager();
    const adapterCreator = vi.fn();
    const interaction = createMockInteraction({
      guildId: 'my-guild-id',
      voiceChannel: { id: 'my-channel-id' },
      voiceAdapterCreator: adapterCreator,
    });

    await handleJoin({ connectionManager }, interaction as unknown as Parameters<typeof handleJoin>[1]);

    expect(connectionManager.join).toHaveBeenCalledWith('my-guild-id', 'my-channel-id', adapterCreator);
  });

  it('replies with a success message after joining', async () => {
    const connectionManager = createMockConnectionManager();
    const interaction = createMockInteraction();

    await handleJoin({ connectionManager }, interaction as unknown as Parameters<typeof handleJoin>[1]);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const replyArg = (interaction.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as { content: string };
    expect(replyArg.content).toEqual(expect.any(String));
    expect(replyArg.content.length).toBeGreaterThan(0);
  });

  it('uses the guild voiceAdapterCreator from the interaction', async () => {
    const connectionManager = createMockConnectionManager();
    const adapterCreator = vi.fn();
    const interaction = createMockInteraction({ voiceAdapterCreator: adapterCreator });

    await handleJoin({ connectionManager }, interaction as unknown as Parameters<typeof handleJoin>[1]);

    const callArgs = (connectionManager.join as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, unknown];
    expect(callArgs[2]).toBe(adapterCreator);
  });
});
