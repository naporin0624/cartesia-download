import { describe, it, expect } from 'vitest';
import { parseMarkerStream } from './marker-parser.js';

// eslint-disable-next-line func-style -- async generators require function* syntax
async function* toStream(...parts: string[]): AsyncIterable<string> {
  for (const part of parts) {
    yield part;
  }
}

const collect = async (stream: AsyncIterable<string>): Promise<string[]> => {
  const results: string[] = [];
  for await (const chunk of stream) {
    results.push(chunk);
  }
  return results;
};

describe('parseMarkerStream', () => {
  it('yields chunks split by [SEP] marker', async () => {
    const result = await collect(parseMarkerStream(toStream('hello[SEP]world')));
    expect(result).toEqual(['hello', 'world']);
  });

  it('handles [SEP] split across token boundaries', async () => {
    const result = await collect(parseMarkerStream(toStream('hello[S', 'EP]world')));
    expect(result).toEqual(['hello', 'world']);
  });

  it('handles [SEP] split across three tokens', async () => {
    const result = await collect(parseMarkerStream(toStream('hello[', 'SE', 'P]world')));
    expect(result).toEqual(['hello', 'world']);
  });

  it('flushes remaining buffer on stream end', async () => {
    const result = await collect(parseMarkerStream(toStream('hello[SEP]world')));
    expect(result).toEqual(['hello', 'world']);
  });

  it('returns single chunk when no markers present', async () => {
    const result = await collect(parseMarkerStream(toStream('no markers here')));
    expect(result).toEqual(['no markers here']);
  });

  it('handles multiple consecutive markers', async () => {
    const result = await collect(parseMarkerStream(toStream('a[SEP]b[SEP]c')));
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('skips empty chunks between markers', async () => {
    const result = await collect(parseMarkerStream(toStream('a[SEP][SEP]b')));
    expect(result).toEqual(['a', 'b']);
  });

  it('handles empty stream', async () => {
    const result = await collect(parseMarkerStream(toStream()));
    expect(result).toEqual([]);
  });

  it('handles stream with only whitespace chunks', async () => {
    const result = await collect(parseMarkerStream(toStream('  ', '  ')));
    expect(result).toEqual(['    ']);
  });

  it('preserves SSML tags in output', async () => {
    const result = await collect(parseMarkerStream(toStream('<emotion value="excited"/> hello[SEP]<emotion value="sad"/> world')));
    expect(result).toEqual(['<emotion value="excited"/> hello', '<emotion value="sad"/> world']);
  });
});
