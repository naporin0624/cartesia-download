import { describe, it, expect, vi } from 'vitest'
import { createClaudeAnnotator } from './claude-annotator.js'
import type { CartesiaDownloadError } from '../types.js'

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

import { generateText } from 'ai'

const mockGenerateText = vi.mocked(generateText)

describe('createClaudeAnnotator', () => {
  it('returns SSML-annotated text from Claude', async () => {
    const annotatedText = '<emotion value="excited"/> こんにちは！ <emotion value="neutral"/> 今日はいい天気ですね。'
    mockGenerateText.mockResolvedValue({
      text: annotatedText,
    } as Awaited<ReturnType<typeof generateText>>)

    const annotator = createClaudeAnnotator()
    const result = await annotator.annotate('こんにちは！今日はいい天気ですね。')

    expect(result).toBe(annotatedText)
    expect(mockGenerateText).toHaveBeenCalledOnce()
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('SSML'),
        prompt: 'こんにちは！今日はいい天気ですね。',
      }),
    )
  })

  it('returns AnnotationError when generateText throws', async () => {
    const apiError = new Error('API key invalid')
    mockGenerateText.mockRejectedValue(apiError)

    const annotator = createClaudeAnnotator()
    const result = await annotator.annotate('テスト')

    const error = result as CartesiaDownloadError
    expect(error.type).toBe('AnnotationError')
    expect((error as { type: 'AnnotationError'; cause: unknown }).cause).toBe(apiError)
  })

  it('returns original text when Claude returns empty string', async () => {
    mockGenerateText.mockResolvedValue({
      text: '',
    } as Awaited<ReturnType<typeof generateText>>)

    const annotator = createClaudeAnnotator()
    const result = await annotator.annotate('元のテキスト')

    expect(result).toBe('元のテキスト')
  })
})
