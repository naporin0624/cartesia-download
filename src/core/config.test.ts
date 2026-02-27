import { describe, it, expect } from 'vitest';
import type { RawCliArgs, RcConfig } from '../types.js';
import { resolveConfig } from './config.js';

describe('resolveConfig', () => {
  const fullArgs: RawCliArgs = {
    text: 'hello world',
    'voice-id': 'voice-from-args',
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
    };
    const result = resolveConfig(args, {}, rc);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      apiKey: 'key-from-rc',
      voiceId: 'voice-from-rc',
      model: 'sonic-1',
      sampleRate: 16000,
      outputPath: '/tmp/out.wav',
      text: 'hello',
    });
  });

  it('uses defaults for model and sampleRate', () => {
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

  it('resolves successfully without outputPath', () => {
    const args: RawCliArgs = {
      text: 'hello',
      'voice-id': 'voice',
    };
    const env = { CARTESIA_API_KEY: 'key' };
    const result = resolveConfig(args, env, {});
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().outputPath).toBeUndefined();
  });
});
