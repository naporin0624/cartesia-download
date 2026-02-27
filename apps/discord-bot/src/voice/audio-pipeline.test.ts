import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { Readable } from 'node:stream';

vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: vi.fn(),
  createAudioPlayer: vi.fn(),
  createAudioResource: vi.fn(),
  StreamType: { Arbitrary: 'arbitrary' },
  AudioPlayerStatus: { Idle: 'idle', Playing: 'playing' },
  VoiceConnectionStatus: { Ready: 'ready' },
  NoSubscriberBehavior: { Pause: 'pause' },
}));

import { createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } from '@discordjs/voice';
import { createAudioStream, playAudio } from './audio-pipeline';

// eslint-disable-next-line func-style -- async generators require function* syntax
async function* makeAsyncIterable(chunks: Uint8Array[]): AsyncIterable<Uint8Array> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe('createAudioStream', () => {
  it('returns a Readable stream', () => {
    const iterable = makeAsyncIterable([]);
    const stream = createAudioStream(iterable);

    expect(stream).toBeInstanceOf(Readable);
  });

  it('emits all chunks from the AsyncIterable', async () => {
    const chunk1 = new Uint8Array([1, 2, 3]);
    const chunk2 = new Uint8Array([4, 5, 6]);
    const iterable = makeAsyncIterable([chunk1, chunk2]);

    const stream = createAudioStream(iterable);

    const collected: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => collected.push(chunk));
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    const result = Buffer.concat(collected);
    expect(result).toEqual(Buffer.from([1, 2, 3, 4, 5, 6]));
  });

  it('emits end when AsyncIterable is exhausted', async () => {
    const iterable = makeAsyncIterable([new Uint8Array([0xff])]);
    const stream = createAudioStream(iterable);

    await new Promise<void>((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
      stream.resume();
    });
  });

  it('returns a Readable for an empty AsyncIterable', async () => {
    const iterable = makeAsyncIterable([]);
    const stream = createAudioStream(iterable);

    const collected: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => collected.push(chunk));
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    expect(Buffer.concat(collected).length).toBe(0);
  });
});

describe('playAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeFakePlayer = (idleStatus = AudioPlayerStatus.Idle) => {
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    const player = {
      play: vi.fn(),
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
        return player;
      }),
      _emit: (event: string, ...args: unknown[]) => {
        (listeners[event] ?? []).map((cb) => cb(...args));
      },
      state: { status: idleStatus },
    };
    return player;
  };

  const makeFakeConnection = () => ({
    subscribe: vi.fn(),
  });

  it('creates AudioPlayer via createAudioPlayer', async () => {
    const fakePlayer = makeFakePlayer();
    (createAudioPlayer as unknown as MockInstance).mockReturnValue(fakePlayer);
    (createAudioResource as unknown as MockInstance).mockReturnValue({});

    const stream = Readable.from([]);
    const connection = makeFakeConnection();

    const playPromise = playAudio(connection as unknown as Parameters<typeof playAudio>[0], stream, 48000);
    fakePlayer._emit('stateChange', { status: 'playing' }, { status: AudioPlayerStatus.Idle });
    await playPromise;

    expect(createAudioPlayer).toHaveBeenCalled();
  });

  it('creates AudioResource with StreamType.Arbitrary', async () => {
    const fakePlayer = makeFakePlayer();
    (createAudioPlayer as unknown as MockInstance).mockReturnValue(fakePlayer);
    (createAudioResource as unknown as MockInstance).mockReturnValue({});

    const stream = Readable.from([]);
    const connection = makeFakeConnection();

    const playPromise = playAudio(connection as unknown as Parameters<typeof playAudio>[0], stream, 48000);
    fakePlayer._emit('stateChange', { status: 'playing' }, { status: AudioPlayerStatus.Idle });
    await playPromise;

    expect(createAudioResource).toHaveBeenCalledWith(
      stream,
      expect.objectContaining({ inputType: StreamType.Arbitrary }),
    );
  });

  it('subscribes connection to the player', async () => {
    const fakePlayer = makeFakePlayer();
    (createAudioPlayer as unknown as MockInstance).mockReturnValue(fakePlayer);
    (createAudioResource as unknown as MockInstance).mockReturnValue({});

    const stream = Readable.from([]);
    const connection = makeFakeConnection();

    const playPromise = playAudio(connection as unknown as Parameters<typeof playAudio>[0], stream, 48000);
    fakePlayer._emit('stateChange', { status: 'playing' }, { status: AudioPlayerStatus.Idle });
    await playPromise;

    expect(connection.subscribe).toHaveBeenCalledWith(fakePlayer);
  });

  it('resolves when player reaches Idle status', async () => {
    const fakePlayer = makeFakePlayer();
    (createAudioPlayer as unknown as MockInstance).mockReturnValue(fakePlayer);
    (createAudioResource as unknown as MockInstance).mockReturnValue({});

    const stream = Readable.from([]);
    const connection = makeFakeConnection();

    const playPromise = playAudio(connection as unknown as Parameters<typeof playAudio>[0], stream, 48000);

    // Simulate player transitioning through playing -> idle
    fakePlayer._emit('stateChange', { status: 'playing' }, { status: AudioPlayerStatus.Idle });

    await expect(playPromise).resolves.toBeUndefined();
  });

  it('calls player.play with the audio resource', async () => {
    const fakePlayer = makeFakePlayer();
    const fakeResource = { resource: 'fake' };
    (createAudioPlayer as unknown as MockInstance).mockReturnValue(fakePlayer);
    (createAudioResource as unknown as MockInstance).mockReturnValue(fakeResource);

    const stream = Readable.from([]);
    const connection = makeFakeConnection();

    const playPromise = playAudio(connection as unknown as Parameters<typeof playAudio>[0], stream, 48000);
    fakePlayer._emit('stateChange', { status: 'playing' }, { status: AudioPlayerStatus.Idle });
    await playPromise;

    expect(fakePlayer.play).toHaveBeenCalledWith(fakeResource);
  });
});
