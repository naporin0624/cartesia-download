import { Client, GatewayIntentBits } from 'discord.js';
import type { BotConfig } from './config';

export const createBot = (config: BotConfig): Client => {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  client.once('ready', (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
  });

  return client;
};

export const startBot = async (client: Client, token: string): Promise<void> => {
  await client.login(token);
};
