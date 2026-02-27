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
    case 'MissingOutput':
      return 'Output path is required. Use --output flag.';
    case 'InvalidFormat':
      return `Unsupported audio format "${error.value}". Supported formats: wav, mp3.`;
    case 'FileReadError':
      return `Failed to read file: ${error.path}`;
    case 'FileWriteError':
      return `Failed to write file: ${error.path}`;
    case 'TtsApiError':
      return `Cartesia TTS API error: ${causeMessage(error.cause)}`;
    case 'AnnotationError':
      return `Emotion annotation failed: ${causeMessage(error.cause)}`;
    case 'UnsupportedProvider':
      return `Unsupported annotation provider "${error.provider}". Supported: claude.`;
  }
};
