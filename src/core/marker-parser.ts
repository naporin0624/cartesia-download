const MARKER = '[SEP]';

// eslint-disable-next-line func-style -- async generators require function* syntax
export async function* parseMarkerStream(stream: AsyncIterable<string>): AsyncIterable<string> {
  let buffer = '';

  for await (const token of stream) {
    buffer += token;

    let markerIndex = buffer.indexOf(MARKER);
    while (markerIndex !== -1) {
      const chunk = buffer.slice(0, markerIndex).trim();
      if (chunk.length > 0) {
        yield chunk;
      }
      buffer = buffer.slice(markerIndex + MARKER.length);
      markerIndex = buffer.indexOf(MARKER);
    }
  }

  if (buffer.length > 0) {
    yield buffer;
  }
}
