import { describe, it, expect, vi } from 'vitest';
import { createAnnotator } from './annotator';

vi.mock('./providers/claude-annotator', () => ({
  createClaudeAnnotator: vi.fn(() => ({
    annotate: vi.fn().mockResolvedValue('annotated text'),
  })),
}));

describe('createAnnotator', () => {
  it('returns a Claude annotator for provider "claude"', () => {
    const result = createAnnotator('claude');
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toHaveProperty('annotate');
  });

  it('returns UnsupportedProvider error for unknown provider', () => {
    const result = createAnnotator('unknown-provider');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({ type: 'UnsupportedProvider', provider: 'unknown-provider' });
  });
});
