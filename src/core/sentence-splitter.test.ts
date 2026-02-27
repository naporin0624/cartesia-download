import { describe, it, expect } from 'vitest';
import { splitSentences } from './sentence-splitter.js';

describe('splitSentences', () => {
  it('splits standard Japanese text on 。', () => {
    const result = splitSentences('今日はいい天気です。明日も晴れるでしょう。');
    expect(result).toEqual(['今日はいい天気です。', '明日も晴れるでしょう。']);
  });

  it('splits on mixed terminators 。！？', () => {
    const result = splitSentences('すごい！本当ですか？はい。');
    expect(result).toEqual(['すごい！', '本当ですか？', 'はい。']);
  });

  it('returns the whole string as a single element when there is no terminator', () => {
    const result = splitSentences('こんにちは');
    expect(result).toEqual(['こんにちは']);
  });

  it('includes trailing closing brackets 」）』 as part of the sentence', () => {
    const result = splitSentences('「大丈夫です。」彼は言った。');
    expect(result).toEqual(['「大丈夫です。」', '彼は言った。']);
  });

  it('preserves SSML emotion tags within their respective sentences', () => {
    const input = '<emotion value="happy">楽しい。</emotion><emotion value="sad">悲しい。</emotion>';
    const result = splitSentences(input);
    expect(result).toEqual(['<emotion value="happy">楽しい。</emotion>', '<emotion value="sad">悲しい。</emotion>']);
  });

  it('returns [""] for an empty string', () => {
    const result = splitSentences('');
    expect(result).toEqual(['']);
  });

  it('returns a single element array for a single sentence with terminator', () => {
    const result = splitSentences('はい。');
    expect(result).toEqual(['はい。']);
  });
});
