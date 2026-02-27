import { describe, it, expect, vi } from 'vitest';
import { createClaudeAnnotator } from './claude-annotator';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
}));

import { generateText, streamText } from 'ai';

const mockGenerateText = vi.mocked(generateText);
const mockStreamText = vi.mocked(streamText);

describe('createClaudeAnnotator', () => {
  it('returns SSML-annotated text from Claude', async () => {
    const annotatedText = '<emotion value="excited"/> こんにちは！ <emotion value="neutral"/> 今日はいい天気ですね。';
    mockGenerateText.mockResolvedValue({
      text: annotatedText,
    } as Awaited<ReturnType<typeof generateText>>);

    const annotator = createClaudeAnnotator();
    const result = await annotator.annotate('こんにちは！今日はいい天気ですね。');

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(annotatedText);
    expect(mockGenerateText).toHaveBeenCalledOnce();
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('SSML'),
        prompt: 'こんにちは！今日はいい天気ですね。',
      }),
    );
  });

  it('returns AnnotationError when generateText throws', async () => {
    const apiError = new Error('API key invalid');
    mockGenerateText.mockRejectedValue(apiError);

    const annotator = createClaudeAnnotator();
    const result = await annotator.annotate('テスト');

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe('AnnotationError');
    expect((result._unsafeUnwrapErr() as { type: 'AnnotationError'; cause: unknown }).cause).toBe(apiError);
  });

  it('returns original text when Claude returns empty string', async () => {
    mockGenerateText.mockResolvedValue({
      text: '',
    } as Awaited<ReturnType<typeof generateText>>);

    const annotator = createClaudeAnnotator();
    const result = await annotator.annotate('元のテキスト');

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe('元のテキスト');
  });
});

describe('createClaudeAnnotator stream', () => {
  it('returns AsyncIterable of speech chunks parsed by [SEP] markers', async () => {
    // eslint-disable-next-line func-style -- async generators require function* syntax
    async function* fakeTextStream() {
      yield '<emotion value="excited"/> hello[SEP]';
      yield '<emotion value="sad"/> world';
    }
    mockStreamText.mockReturnValue({ textStream: fakeTextStream() } as unknown as ReturnType<typeof streamText>);

    const annotator = createClaudeAnnotator();
    const result = await annotator.stream('hello world');

    expect(result.isOk()).toBe(true);
    const chunks: string[] = [];
    for await (const chunk of result._unsafeUnwrap()) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['<emotion value="excited"/> hello', '<emotion value="sad"/> world']);
  });

  it('passes system prompt with [SEP] instructions to streamText', async () => {
    // eslint-disable-next-line func-style -- async generators require function* syntax
    async function* fakeTextStream() {
      yield 'annotated text';
    }
    mockStreamText.mockReturnValue({ textStream: fakeTextStream() } as unknown as ReturnType<typeof streamText>);

    const annotator = createClaudeAnnotator();
    await annotator.stream('test');

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('[SEP]'),
        prompt: 'test',
      }),
    );
  });

  it('returns AnnotationError when streamText throws', async () => {
    mockStreamText.mockImplementation(() => {
      throw new Error('API error');
    });

    const annotator = createClaudeAnnotator();
    const result = await annotator.stream('test');

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe('AnnotationError');
  });
});
