import { createHash } from 'node:crypto';

export const computeHash = (input: string): string => {
  return createHash('sha256').update(input).digest('hex');
};

export const computeAudioCacheKey = (params: { text: string; voiceId: string; model: string; sampleRate: number }): string => {
  return computeHash(JSON.stringify(params));
};
