import type { DiscordGatewayAdapterCreator } from '@discordjs/voice';

// Methods typed as Function to allow vi.fn() mocks in tests (Mock<Procedure | Constructable>)
type ConnectionManagerLike = {
  join: Function;
  leave: Function;
  getConnection: Function;
  destroy: Function;
};

type JoinDeps = {
  connectionManager: ConnectionManagerLike;
};

type JoinInteraction = {
  guildId: string;
  member: {
    voice: {
      channel: { id: string } | null;
    };
  };
  guild: {
    voiceAdapterCreator: DiscordGatewayAdapterCreator;
  };
  reply: (options: { content: string; ephemeral?: boolean }) => Promise<unknown>;
};

type JoinFn = (guildId: string, channelId: string, adapterCreator: DiscordGatewayAdapterCreator) => void;

export const handleJoin = async (deps: JoinDeps, interaction: JoinInteraction): Promise<void> => {
  const { connectionManager } = deps;
  const voiceChannel = interaction.member.voice.channel;

  if (voiceChannel === null) {
    await interaction.reply({ content: 'You must be in a voice channel to use this command.', ephemeral: true });
    return;
  }

  const join = connectionManager.join as JoinFn;
  join(interaction.guildId, voiceChannel.id, interaction.guild.voiceAdapterCreator);
  await interaction.reply({ content: 'Joined voice channel.' });
};
