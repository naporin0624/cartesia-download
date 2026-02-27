import { loadConfig } from './config';
import { createBot, startBot } from './bot';

const config = loadConfig(process.env);
const client = createBot(config);

await startBot(client, config.discordToken);
