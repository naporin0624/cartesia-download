import { ok, err, type Result } from 'neverthrow';
import type { TextAnnotator, CartesiaDownloadError } from '../types.js';
import { createClaudeAnnotator } from '../providers/claude-annotator.js';

type AnnotatorOptions = {
  apiKey?: string;
  model?: string;
};

export const createAnnotator = (provider: string, options?: AnnotatorOptions): Result<TextAnnotator, CartesiaDownloadError> => {
  switch (provider) {
    case 'claude':
      return ok(createClaudeAnnotator(options));
    default:
      return err({ type: 'UnsupportedProvider', provider });
  }
};
