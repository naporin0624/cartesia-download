import { cli } from 'gunshi';
import { downloadCommand } from './commands/download';

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;

await cli(args, downloadCommand, {
  name: 'cartesia-download',
  version: '1.0.0',
  description: 'Download audio from Cartesia TTS API',
  usageSilent: true,
});
