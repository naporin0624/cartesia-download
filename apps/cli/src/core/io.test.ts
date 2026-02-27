import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises');

import fs from 'node:fs/promises';
import { createIO } from './io';

const mockedFs = vi.mocked(fs);

describe('createIO', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('readTextFile', () => {
    it('returns file content for existing file', async () => {
      mockedFs.readFile.mockResolvedValue('text content');
      const io = createIO();
      const result = await io.readTextFile('/path/to/file.txt');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBe('text content');
      expect(mockedFs.readFile).toHaveBeenCalledWith('/path/to/file.txt', 'utf-8');
    });

    it('returns FileReadError when file does not exist', async () => {
      const cause = new Error('ENOENT');
      mockedFs.readFile.mockRejectedValue(cause);
      const io = createIO();
      const result = await io.readTextFile('/missing.txt');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toEqual({ type: 'FileReadError', path: '/missing.txt', cause });
    });
  });

  describe('readRcFile', () => {
    it('returns parsed config from existing file', async () => {
      mockedFs.readFile.mockResolvedValue('{"apiKey":"key","voiceId":"v1"}');
      const io = createIO();
      const result = await io.readRcFile('/path/.cartesiarc.json');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({ apiKey: 'key', voiceId: 'v1' });
    });

    it('returns empty object when file does not exist', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('ENOENT'));
      const io = createIO();
      const result = await io.readRcFile('/missing.json');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({});
    });
  });

  describe('writeFile', () => {
    it('writes data to specified path', async () => {
      mockedFs.writeFile.mockResolvedValue(undefined);
      const io = createIO();
      const result = await io.writeFile('/out.txt', 'content');
      expect(result.isOk()).toBe(true);
      expect(mockedFs.writeFile).toHaveBeenCalledWith('/out.txt', 'content');
    });

    it('returns FileWriteError on failure', async () => {
      const cause = new Error('disk full');
      mockedFs.writeFile.mockRejectedValue(cause);
      const io = createIO();
      const result = await io.writeFile('/fail.txt', 'x');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toEqual({ type: 'FileWriteError', path: '/fail.txt', cause });
    });
  });
});
