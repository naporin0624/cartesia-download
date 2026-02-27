import { describe, it, expect } from 'vitest';
import { computeHash, computeAudioCacheKey } from './hash';

describe('computeHash', () => {
  it('returns a consistent SHA-256 hex for the same input', () => {
    const result1 = computeHash('hello world');
    const result2 = computeHash('hello world');
    expect(result1).toBe(result2);
  });

  it('returns different hashes for different inputs', () => {
    const hash1 = computeHash('input-a');
    const hash2 = computeHash('input-b');
    expect(hash1).not.toBe(hash2);
  });

  it('returns a 64-character hex string', () => {
    const result = computeHash('test input');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns different hash for empty string vs non-empty string', () => {
    const emptyHash = computeHash('');
    const nonEmptyHash = computeHash('a');
    expect(emptyHash).not.toBe(nonEmptyHash);
  });
});

describe('computeAudioCacheKey', () => {
  it('returns a consistent hash for the same params', () => {
    const params = { text: 'hello', voiceId: 'voice-123', model: 'sonic-2', sampleRate: 44100 };
    const key1 = computeAudioCacheKey(params);
    const key2 = computeAudioCacheKey(params);
    expect(key1).toBe(key2);
  });

  it('returns a different hash when text changes', () => {
    const base = { voiceId: 'voice-123', model: 'sonic-2', sampleRate: 44100 };
    const key1 = computeAudioCacheKey({ ...base, text: 'hello' });
    const key2 = computeAudioCacheKey({ ...base, text: 'world' });
    expect(key1).not.toBe(key2);
  });

  it('returns a different hash when voiceId changes', () => {
    const base = { text: 'hello', model: 'sonic-2', sampleRate: 44100 };
    const key1 = computeAudioCacheKey({ ...base, voiceId: 'voice-aaa' });
    const key2 = computeAudioCacheKey({ ...base, voiceId: 'voice-bbb' });
    expect(key1).not.toBe(key2);
  });

  it('returns a different hash when model changes', () => {
    const base = { text: 'hello', voiceId: 'voice-123', sampleRate: 44100 };
    const key1 = computeAudioCacheKey({ ...base, model: 'sonic-2' });
    const key2 = computeAudioCacheKey({ ...base, model: 'sonic-3' });
    expect(key1).not.toBe(key2);
  });

  it('returns a different hash when sampleRate changes', () => {
    const base = { text: 'hello', voiceId: 'voice-123', model: 'sonic-2' };
    const key1 = computeAudioCacheKey({ ...base, sampleRate: 44100 });
    const key2 = computeAudioCacheKey({ ...base, sampleRate: 22050 });
    expect(key1).not.toBe(key2);
  });
});
