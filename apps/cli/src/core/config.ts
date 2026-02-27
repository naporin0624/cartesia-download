import { ok, err, type Result } from 'neverthrow';
import type { ConfigError, RawCliArgs, RcConfig, ResolvedConfig } from '../types';

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
  const model = args.model ?? rc.model ?? 'sonic-3';
  const sampleRate = args['sample-rate'] ?? rc.sampleRate ?? 44100;
  const language = 'ja';

  return ok({ apiKey, voiceId, model, sampleRate, language, outputPath, text });
};
