import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleLeave } from './leave';

type MockConnectionManager = {
  join: ReturnType<typeof vi.fn>;
  leave: ReturnType<typeof vi.fn>;
  getConnection: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

type MockInteractionOverrides = {
  guildId?: string;
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
    getString: vi.fn(),
  },
  reply: vi.fn().mockResolvedValue(undefined),
  deferReply: vi.fn().mockResolvedValue(undefined),
  editReply: vi.fn().mockResolvedValue(undefined),
});

const createMockConnectionManager = (leaveResult = true): MockConnectionManager => ({
  join: vi.fn(),
  leave: vi.fn().mockReturnValue(leaveResult),
  getConnection: vi.fn().mockReturnValue(undefined),
  destroy: vi.fn(),
});

describe('handleLeave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls connectionManager.leave with the guildId', async () => {
    const connectionManager = createMockConnectionManager(true);
    const interaction = createMockInteraction({ guildId: 'guild-abc' });

    await handleLeave({ connectionManager }, interaction as unknown as Parameters<typeof handleLeave>[1]);

    expect(connectionManager.leave).toHaveBeenCalledWith('guild-abc');
  });

  it('replies with a success message when bot was in a voice channel', async () => {
    const connectionManager = createMockConnectionManager(true);
    const interaction = createMockInteraction();

    await handleLeave({ connectionManager }, interaction as unknown as Parameters<typeof handleLeave>[1]);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const replyArg = (interaction.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as { content: string };
    expect(replyArg.content).toEqual(expect.any(String));
    expect(replyArg.content.length).toBeGreaterThan(0);
  });

  it('replies with an error when bot is not in a voice channel', async () => {
    const connectionManager = createMockConnectionManager(false);
    const interaction = createMockInteraction();

    await handleLeave({ connectionManager }, interaction as unknown as Parameters<typeof handleLeave>[1]);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.any(String),
        ephemeral: true,
      }),
    );
  });

  it('does not call join when handling leave', async () => {
    const connectionManager = createMockConnectionManager(true);
    const interaction = createMockInteraction();

    await handleLeave({ connectionManager }, interaction as unknown as Parameters<typeof handleLeave>[1]);

    expect(connectionManager.join).not.toHaveBeenCalled();
  });
});
