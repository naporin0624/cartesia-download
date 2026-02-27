import { describe, it, expect } from 'vitest';
import { formatError } from './format-error.js';

describe('formatError', () => {
  it('formats MissingApiKey', () => {
    expect(formatError({ type: 'MissingApiKey' })).toBe('API key is required. Set CARTESIA_API_KEY environment variable or add apiKey to .cartesiarc.json.');
  });

  it('formats MissingVoiceId', () => {
    expect(formatError({ type: 'MissingVoiceId' })).toBe('Voice ID is required. Use --voice-id flag or set CARTESIA_VOICE_ID environment variable.');
  });

  it('formats MissingText', () => {
    expect(formatError({ type: 'MissingText' })).toBe('Text is required. Use --text flag or --input to read from a file.');
  });

  it('formats TtsStreamError', () => {
    expect(formatError({ type: 'TtsStreamError', sentenceIndex: 2, cause: new Error('connection reset') })).toBe('TTS stream failed at sentence 3: connection reset');
  });

  it('formats FileReadError', () => {
    expect(formatError({ type: 'FileReadError', path: '/tmp/x.txt', cause: new Error('ENOENT') })).toBe('Failed to read file: /tmp/x.txt');
  });

  it('formats FileWriteError', () => {
    expect(formatError({ type: 'FileWriteError', path: '/tmp/out.wav', cause: new Error('disk full') })).toBe('Failed to write file: /tmp/out.wav');
  });

  it('formats TtsApiError', () => {
    expect(formatError({ type: 'TtsApiError', cause: new Error('timeout') })).toBe('Cartesia TTS API error: timeout');
  });

  it('formats TtsApiError with non-Error cause', () => {
    expect(formatError({ type: 'TtsApiError', cause: 'unknown' })).toBe('Cartesia TTS API error: unknown');
  });

  it('formats AnnotationError', () => {
    expect(formatError({ type: 'AnnotationError', cause: new Error('rate limit') })).toBe('Emotion annotation failed: rate limit');
  });

  it('formats UnsupportedProvider', () => {
    expect(formatError({ type: 'UnsupportedProvider', provider: 'openai' })).toBe('Unsupported annotation provider "openai". Supported: claude.');
  });
});
