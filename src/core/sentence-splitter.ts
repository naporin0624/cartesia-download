export const splitSentences = (text: string): string[] => {
  const matches = text.match(/[^。！？]*[。！？][」）』]?(?:<\/[^>]+>)*/gu) ?? [];
  const lastEnd = matches.reduce((acc, m) => acc + m.length, 0);
  const remainder = text.slice(lastEnd).trim();
  const result = remainder ? [...matches, remainder] : matches;
  const filtered = result.filter((s) => s.trim().length > 0);
  return filtered.length > 0 ? filtered : [text];
};
