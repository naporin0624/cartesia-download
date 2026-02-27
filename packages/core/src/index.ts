// Types
export type { TtsConfig, TtsError, AnnotationError, CoreError, TtsClient, AnnotatorProvider, TextAnnotator } from './types';

// TTS Client
export { createCartesiaTtsClient, buildRawOutputFormat } from './tts-client';
export type { CartesiaLikeClient, RawOutputFormat } from './tts-client';

// Pipeline
export { runStreamingPipeline } from './pipeline';

// Annotator
export { createAnnotator } from './annotator';

// Providers
export { createClaudeAnnotator } from './providers/claude-annotator';

// Marker Parser
export { parseMarkerStream } from './marker-parser';

// WAV
export { buildWavHeader } from './wav';
