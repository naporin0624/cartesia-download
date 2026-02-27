import type { TextAnnotator, CartesiaDownloadError } from '../types.js';
import { createClaudeAnnotator } from '../providers/claude-annotator.js';

type AnnotatorOptions = {
  apiKey?: string;
  model?: string;
};

export const createAnnotator = (provider: string, options?: AnnotatorOptions): TextAnnotator | CartesiaDownloadError => {
  switch (provider) {
    case 'claude':
      return createClaudeAnnotator(options);
    default:
      return { type: 'UnsupportedProvider', provider };
  }
};
