import { ok, err, type Result } from 'neverthrow';
import type { AudioFormat, ConfigError, RawCliArgs, RcConfig, ResolvedConfig } from '../types.js';

export const parseFormat = (value: string): Result<AudioFormat, ConfigError> => {
  const lower = value.toLowerCase();
  if (lower === 'wav' || lower === 'mp3') {
    return ok(lower);
  }
  return err({ type: 'InvalidFormat', value });
};

export const resolveConfig = (args: RawCliArgs, env: Record<string, string | undefined>, rc: RcConfig): Result<ResolvedConfig, ConfigError> => {
  const apiKey = env['CARTESIA_API_KEY'] ?? rc.apiKey;
  if (!apiKey) {
    return err({ type: 'MissingApiKey' });
  }

  const voiceId = args['voice-id'] ?? env['CARTESIA_VOICE_ID'] ?? rc.voiceId;
  if (!voiceId) {
    return err({ type: 'MissingVoiceId' });
  }

  const text = args.text;
  if (!text) {
    return err({ type: 'MissingText' });
  }

  const outputPath = args.output ?? rc.outputPath;
  if (!outputPath) {
    return err({ type: 'MissingOutput' });
  }

  const rawFormat = args.format ?? rc.format ?? 'wav';

  return parseFormat(rawFormat).map((format) => {
    const model = args.model ?? rc.model ?? 'sonic-3';
    const sampleRate = args['sample-rate'] ?? rc.sampleRate ?? 44100;
    return { apiKey, voiceId, model, sampleRate, format, outputPath, text };
  });
};
