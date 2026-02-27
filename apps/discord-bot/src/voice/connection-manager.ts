import { joinVoiceChannel } from '@discordjs/voice';
import type { VoiceConnection, DiscordGatewayAdapterCreator } from '@discordjs/voice';

type ConnectionMap = Map<string, VoiceConnection>;

export type ConnectionManager = {
  join: (guildId: string, channelId: string, adapterCreator: DiscordGatewayAdapterCreator) => VoiceConnection;
  leave: (guildId: string) => boolean;
  getConnection: (guildId: string) => VoiceConnection | undefined;
  destroy: () => void;
};

export const createConnectionManager = (): ConnectionManager => {
  const connections: ConnectionMap = new Map();

  const join = (guildId: string, channelId: string, adapterCreator: DiscordGatewayAdapterCreator): VoiceConnection => {
    const existing = connections.get(guildId);
    if (existing !== undefined) {
      existing.destroy();
    }

    const connection = joinVoiceChannel({ guildId, channelId, adapterCreator });
    connections.set(guildId, connection);
    return connection;
  };

  const leave = (guildId: string): boolean => {
    const connection = connections.get(guildId);
    if (connection === undefined) {
      return false;
    }
    connection.destroy();
    connections.delete(guildId);
    return true;
  };

  const getConnection = (guildId: string): VoiceConnection | undefined => {
    return connections.get(guildId);
  };

  const destroy = (): void => {
    connections.forEach((connection) => {
      connection.destroy();
    });
    connections.clear();
  };

  return { join, leave, getConnection, destroy };
};
