import fs from 'node:fs/promises';
import { ok, err, ResultAsync, type Result } from 'neverthrow';
import type { AudioFormat, CartesiaDownloadError, RawCliArgs, RcConfig, ResolvedConfig } from '../types.js';

export const parseFormat = (value: string): Result<AudioFormat, CartesiaDownloadError> => {
  const lower = value.toLowerCase();
  if (lower === 'wav' || lower === 'mp3') {
    return ok(lower);
  }
  return err({ type: 'InvalidFormat', value });
};

export const resolveConfig = (args: RawCliArgs, env: Record<string, string | undefined>, rc: RcConfig): Result<ResolvedConfig, CartesiaDownloadError> => {
  // Resolve apiKey: env > rc (no CLI arg for apiKey)
  const apiKey = env['CARTESIA_API_KEY'] ?? rc.apiKey;
  if (!apiKey) {
    return err({ type: 'MissingApiKey' });
  }

  // Resolve voiceId: CLI > env > rc
  const voiceId = args['voice-id'] ?? env['CARTESIA_VOICE_ID'] ?? rc.voiceId;
  if (!voiceId) {
    return err({ type: 'MissingVoiceId' });
  }

  // Resolve text: CLI args only
  const text = args.text;
  if (!text) {
    return err({ type: 'MissingText' });
  }

  // Resolve outputPath: CLI > rc
  const outputPath = args.output ?? rc.outputPath;
  if (!outputPath) {
    return err({ type: 'MissingOutput' });
  }

  // Resolve format: CLI > rc > default
  const rawFormat = args.format ?? rc.format ?? 'wav';

  return parseFormat(rawFormat).map((format) => {
    // Resolve model: CLI > rc > default
    const model = args.model ?? rc.model ?? 'sonic-3';

    // Resolve sampleRate: CLI > rc > default
    const sampleRate = args['sample-rate'] ?? rc.sampleRate ?? 44100;

    return {
      apiKey,
      voiceId,
      model,
      sampleRate,
      format,
      outputPath,
      text,
    };
  });
};

export const readRcFile = async (path: string): Promise<RcConfig> => {
  try {
    const content = await fs.readFile(path, 'utf-8');
    return JSON.parse(content) as RcConfig;
  } catch {
    return {};
  }
};

export const readTextFile = (filePath: string): ResultAsync<string, CartesiaDownloadError> =>
  ResultAsync.fromPromise(fs.readFile(filePath, 'utf-8'), (cause): CartesiaDownloadError => ({ type: 'FileReadError', path: filePath, cause }));
