import fs from 'node:fs/promises';
import { ResultAsync } from 'neverthrow';
import type { FileOutput, IOError, TtsResult } from '../types.js';

export const createFileOutput = (): FileOutput => ({
  write(path: string, result: TtsResult): ResultAsync<void, IOError> {
    return ResultAsync.fromPromise(fs.writeFile(path, Buffer.from(result.audioData)), (cause): IOError => ({ type: 'FileWriteError', path, cause }));
  },
});
