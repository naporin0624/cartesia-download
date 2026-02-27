// Methods typed as Function to allow vi.fn() mocks in tests (Mock<Procedure | Constructable>)
type ConnectionManagerLike = {
  join: Function;
  leave: Function;
  getConnection: Function;
  destroy: Function;
};

type LeaveDeps = {
  connectionManager: ConnectionManagerLike;
};

type LeaveInteraction = {
  guildId: string;
  reply: (options: { content: string; ephemeral?: boolean }) => Promise<unknown>;
};

type LeaveFn = (guildId: string) => boolean;

export const handleLeave = async (deps: LeaveDeps, interaction: LeaveInteraction): Promise<void> => {
  const { connectionManager } = deps;
  const leave = connectionManager.leave as LeaveFn;
  const success = leave(interaction.guildId);

  if (!success) {
    await interaction.reply({ content: 'I am not in a voice channel.', ephemeral: true });
    return;
  }

  await interaction.reply({ content: 'Left the voice channel.' });
};
