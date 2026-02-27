import type { AppError } from '../types.js';

const causeMessage = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

export const formatError = (error: AppError): string => {
  switch (error.type) {
    case 'MissingApiKey':
      return 'API key is required. Set CARTESIA_API_KEY environment variable or add apiKey to .cartesiarc.json.';
    case 'MissingVoiceId':
      return 'Voice ID is required. Use --voice-id flag or set CARTESIA_VOICE_ID environment variable.';
    case 'MissingText':
      return 'Text is required. Use --text flag or --input to read from a file.';
    case 'FileReadError':
      return `Failed to read file: ${error.path}`;
    case 'FileWriteError':
      return `Failed to write file: ${error.path}`;
    case 'TtsApiError':
      return `Cartesia TTS API error: ${causeMessage(error.cause)}`;
    case 'TtsStreamError':
      return `TTS stream failed at sentence ${error.sentenceIndex + 1}: ${causeMessage(error.cause)}`;
    case 'AnnotationError':
      return `Emotion annotation failed: ${causeMessage(error.cause)}`;
    case 'UnsupportedProvider':
      return `Unsupported annotation provider "${error.provider}". Supported: claude.`;
  }
};
