import type { TextAnnotator, CartesiaDownloadError } from '../types.js'
import { createClaudeAnnotator } from '../providers/claude-annotator.js'

export function createAnnotator(provider: string): TextAnnotator | CartesiaDownloadError {
  switch (provider) {
    case 'claude':
      return createClaudeAnnotator()
    default:
      return { type: 'UnsupportedProvider', provider }
  }
}
