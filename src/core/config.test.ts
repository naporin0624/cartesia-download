import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RawCliArgs, RcConfig } from '../types.js';

vi.mock('node:fs/promises');

import { parseFormat, resolveConfig, readRcFile, readTextFile } from './config.js';
import fs from 'node:fs/promises';

const mockedFs = vi.mocked(fs);

describe('parseFormat', () => {
  it('returns "wav" for "wav"', () => {
    const result = parseFormat('wav');
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe('wav');
  });

  it('returns "mp3" for "mp3"', () => {
    const result = parseFormat('mp3');
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe('mp3');
  });

  it('is case-insensitive: "WAV" returns "wav"', () => {
    const result = parseFormat('WAV');
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe('wav');
  });

  it('is case-insensitive: "Mp3" returns "mp3"', () => {
    const result = parseFormat('Mp3');
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe('mp3');
  });

  it('returns InvalidFormat error for unsupported format', () => {
    const result = parseFormat('ogg');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({ type: 'InvalidFormat', value: 'ogg' });
  });

  it('returns InvalidFormat error for empty string', () => {
    const result = parseFormat('');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({ type: 'InvalidFormat', value: '' });
  });
});

describe('resolveConfig', () => {
  const fullArgs: RawCliArgs = {
    text: 'hello world',
    'voice-id': 'voice-from-args',
    format: 'mp3',
    output: '/tmp/out.mp3',
    model: 'sonic-2',
    'sample-rate': 22050,
  };

  const fullEnv: Record<string, string | undefined> = {
    CARTESIA_API_KEY: 'key-from-env',
    CARTESIA_VOICE_ID: 'voice-from-env',
  };

  const fullRc: RcConfig = {
    apiKey: 'key-from-rc',
    voiceId: 'voice-from-rc',
    model: 'sonic-1',
    sampleRate: 16000,
    format: 'mp3',
    outputPath: '/tmp/rc-out.mp3',
  };

  it('resolves all fields from CLI args with highest priority', () => {
    const result = resolveConfig(fullArgs, fullEnv, fullRc);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      apiKey: 'key-from-env',
      voiceId: 'voice-from-args',
      model: 'sonic-2',
      sampleRate: 22050,
      format: 'mp3',
      outputPath: '/tmp/out.mp3',
      text: 'hello world',
    });
  });

  it('falls back to env vars when CLI args are missing', () => {
    const args: RawCliArgs = {
      text: 'hello',
      output: '/tmp/out.wav',
    };
    const env = {
      CARTESIA_API_KEY: 'key-from-env',
      CARTESIA_VOICE_ID: 'voice-from-env',
    };
    const result = resolveConfig(args, env, {});
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      apiKey: 'key-from-env',
      voiceId: 'voice-from-env',
      model: 'sonic-3',
      sampleRate: 44100,
      format: 'wav',
      outputPath: '/tmp/out.wav',
      text: 'hello',
    });
  });

  it('falls back to rc config when CLI args and env are missing', () => {
    const args: RawCliArgs = {
      text: 'hello',
      output: '/tmp/out.wav',
    };
    const rc: RcConfig = {
      apiKey: 'key-from-rc',
      voiceId: 'voice-from-rc',
      model: 'sonic-1',
      sampleRate: 16000,
      format: 'mp3',
    };
    const result = resolveConfig(args, {}, rc);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      apiKey: 'key-from-rc',
      voiceId: 'voice-from-rc',
      model: 'sonic-1',
      sampleRate: 16000,
      format: 'mp3',
      outputPath: '/tmp/out.wav',
      text: 'hello',
    });
  });

  it('uses defaults for model, sampleRate, and format', () => {
    const args: RawCliArgs = {
      text: 'hello',
      output: '/tmp/out.wav',
    };
    const env = {
      CARTESIA_API_KEY: 'key',
      CARTESIA_VOICE_ID: 'voice',
    };
    const result = resolveConfig(args, env, {});
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      apiKey: 'key',
      voiceId: 'voice',
      model: 'sonic-3',
      sampleRate: 44100,
      format: 'wav',
      outputPath: '/tmp/out.wav',
      text: 'hello',
    });
  });

  it('returns MissingApiKey when apiKey is not provided', () => {
    const args: RawCliArgs = {
      text: 'hello',
      'voice-id': 'voice',
      output: '/tmp/out.wav',
    };
    const result = resolveConfig(args, {}, {});
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({ type: 'MissingApiKey' });
  });

  it('returns MissingVoiceId when voiceId is not provided', () => {
    const args: RawCliArgs = {
      text: 'hello',
      output: '/tmp/out.wav',
    };
    const env = { CARTESIA_API_KEY: 'key' };
    const result = resolveConfig(args, env, {});
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({ type: 'MissingVoiceId' });
  });

  it('returns MissingText when text is not provided', () => {
    const args: RawCliArgs = {
      'voice-id': 'voice',
      output: '/tmp/out.wav',
    };
    const env = { CARTESIA_API_KEY: 'key' };
    const result = resolveConfig(args, env, {});
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({ type: 'MissingText' });
  });

  it('returns MissingOutput when output is not provided', () => {
    const args: RawCliArgs = {
      text: 'hello',
      'voice-id': 'voice',
    };
    const env = { CARTESIA_API_KEY: 'key' };
    const result = resolveConfig(args, env, {});
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({ type: 'MissingOutput' });
  });

  it('returns InvalidFormat when format is invalid', () => {
    const args: RawCliArgs = {
      text: 'hello',
      'voice-id': 'voice',
      output: '/tmp/out.wav',
      format: 'ogg',
    };
    const env = { CARTESIA_API_KEY: 'key' };
    const result = resolveConfig(args, env, {});
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({ type: 'InvalidFormat', value: 'ogg' });
  });

  it('CLI args override env vars for voiceId', () => {
    const args: RawCliArgs = {
      text: 'hello',
      'voice-id': 'voice-from-args',
      output: '/tmp/out.wav',
    };
    const env = {
      CARTESIA_API_KEY: 'key',
      CARTESIA_VOICE_ID: 'voice-from-env',
    };
    const result = resolveConfig(args, env, {});
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().voiceId).toBe('voice-from-args');
  });

  it('env vars override rc config for apiKey', () => {
    const args: RawCliArgs = {
      text: 'hello',
      'voice-id': 'voice',
      output: '/tmp/out.wav',
    };
    const env = { CARTESIA_API_KEY: 'key-from-env' };
    const rc: RcConfig = { apiKey: 'key-from-rc' };
    const result = resolveConfig(args, env, rc);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().apiKey).toBe('key-from-env');
  });

  it('rc config outputPath is used when CLI output is not provided but rc has it', () => {
    const args: RawCliArgs = {
      text: 'hello',
      'voice-id': 'voice',
    };
    const env = { CARTESIA_API_KEY: 'key' };
    const rc: RcConfig = { outputPath: '/tmp/rc-output.wav' };
    const result = resolveConfig(args, env, rc);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().outputPath).toBe('/tmp/rc-output.wav');
  });
});

describe('readRcFile', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns parsed config from existing file', async () => {
    const rcContent: RcConfig = {
      apiKey: 'test-key',
      voiceId: 'test-voice',
      model: 'sonic-2',
    };
    mockedFs.readFile.mockResolvedValue(JSON.stringify(rcContent));

    const result = await readRcFile('/path/to/.cartesiarc.json');
    expect(result).toEqual(rcContent);
    expect(mockedFs.readFile).toHaveBeenCalledWith('/path/to/.cartesiarc.json', 'utf-8');
  });

  it('returns empty object when file does not exist', async () => {
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    mockedFs.readFile.mockRejectedValue(error);

    const result = await readRcFile('/path/to/.cartesiarc.json');
    expect(result).toEqual({});
  });
});

describe('readTextFile', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns file content for existing file', async () => {
    mockedFs.readFile.mockResolvedValue('Hello, this is the text content.');

    const result = await readTextFile('/path/to/input.txt');
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe('Hello, this is the text content.');
    expect(mockedFs.readFile).toHaveBeenCalledWith('/path/to/input.txt', 'utf-8');
  });

  it('returns FileReadError when file does not exist', async () => {
    const cause = new Error('ENOENT');
    mockedFs.readFile.mockRejectedValue(cause);

    const result = await readTextFile('/path/to/missing.txt');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({
      type: 'FileReadError',
      path: '/path/to/missing.txt',
      cause,
    });
  });
});
