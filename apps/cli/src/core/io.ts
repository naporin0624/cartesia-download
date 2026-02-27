import fs from 'node:fs/promises';
import { ResultAsync, okAsync } from 'neverthrow';
import type { IO, IOError, RcConfig } from '../types';

export const createIO = (): IO => ({
  readTextFile(path: string): ResultAsync<string, IOError> {
    return ResultAsync.fromPromise(fs.readFile(path, 'utf-8'), (cause): IOError => ({ type: 'FileReadError', path, cause }));
  },

  readRcFile(path: string): ResultAsync<RcConfig, never> {
    return ResultAsync.fromPromise(
      (async () => {
        const content = await fs.readFile(path, 'utf-8');
        return JSON.parse(content) as RcConfig;
      })(),
      () => ({}) as never,
    ).orElse(() => okAsync({}));
  },

  writeFile(path: string, data: Buffer | string): ResultAsync<void, IOError> {
    return ResultAsync.fromPromise(fs.writeFile(path, data), (cause): IOError => ({ type: 'FileWriteError', path, cause }));
  },
});
