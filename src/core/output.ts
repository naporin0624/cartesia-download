import fs from 'node:fs/promises';
import { ResultAsync } from 'neverthrow';
import type { CartesiaDownloadError, FileOutput, TtsResult } from '../types.js';

export const createFileOutput = (): FileOutput => ({
  write(path: string, result: TtsResult): ResultAsync<void, CartesiaDownloadError> {
    return ResultAsync.fromPromise(fs.writeFile(path, Buffer.from(result.audioData)), (cause): CartesiaDownloadError => ({ type: 'FileWriteError', path, cause }));
  },
});
