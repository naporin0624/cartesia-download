import { cli } from 'gunshi';
import { downloadCommand } from './commands/download';

await cli(process.argv.slice(2), downloadCommand, {
  name: 'cartesia-download',
  version: '1.0.0',
  description: 'Download audio from Cartesia TTS API',
  usageSilent: true,
});
