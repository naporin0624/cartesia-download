import { describe, it, expect, vi } from 'vitest'
import { createAnnotator } from './annotator.js'
import type { CartesiaDownloadError } from '../types.js'

vi.mock('../providers/claude-annotator.js', () => ({
  createClaudeAnnotator: vi.fn(() => ({
    annotate: vi.fn().mockResolvedValue('annotated text'),
  })),
}))

describe('createAnnotator', () => {
  it('returns a Claude annotator for provider "claude"', () => {
    const result = createAnnotator('claude')
    expect(result).not.toHaveProperty('type')
    expect(result).toHaveProperty('annotate')
  })

  it('returns UnsupportedProvider error for unknown provider', () => {
    const result = createAnnotator('unknown-provider')
    const error = result as CartesiaDownloadError
    expect(error).toEqual({ type: 'UnsupportedProvider', provider: 'unknown-provider' })
  })
})
