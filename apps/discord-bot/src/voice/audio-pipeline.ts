import { Readable } from 'node:stream';
import { createAudioPlayer, createAudioResource, StreamType, AudioPlayerStatus } from '@discordjs/voice';
import type { VoiceConnection, AudioResource } from '@discordjs/voice';

export const createAudioStream = (pcmChunks: AsyncIterable<Uint8Array>): Readable => {
  return Readable.from(pcmChunks);
};

export const playAudio = (connection: VoiceConnection, stream: Readable, _sampleRate: number): Promise<void> => {
  const player = createAudioPlayer();
  const resource: AudioResource = createAudioResource(stream, { inputType: StreamType.Arbitrary });

  connection.subscribe(player);
  player.play(resource);

  return new Promise<void>((resolve) => {
    player.on('stateChange', (_oldState: unknown, newState: unknown) => {
      const state = newState as { status: string };
      if (state.status === AudioPlayerStatus.Idle) {
        resolve();
      }
    });
  });
};
