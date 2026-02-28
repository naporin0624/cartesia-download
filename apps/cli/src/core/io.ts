import fs from 'node:fs/promises';
import path from 'node:path';
import { ResultAsync, okAsync } from 'neverthrow';
import type { IO, IOError, RcConfig } from '../types';

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const findFileUp = async (filename: string, dir: string = process.cwd()): Promise<string | undefined> => {
  const candidate = path.join(dir, filename);
  if (await fileExists(candidate)) return candidate;
  const parent = path.dirname(dir);
  if (parent === dir) return undefined;
  return findFileUp(filename, parent);
};

const readRcFromDisk = async (filename: string): Promise<RcConfig> => {
  const filePath = await findFileUp(filename);
  if (!filePath) return {};
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as RcConfig;
};

export const createIO = (): IO => ({
  readTextFile(filePath: string): ResultAsync<string, IOError> {
    return ResultAsync.fromPromise(fs.readFile(filePath, 'utf-8'), (cause): IOError => ({ type: 'FileReadError', path: filePath, cause }));
  },

  readRcFile(filename: string): ResultAsync<RcConfig, never> {
    return ResultAsync.fromPromise(readRcFromDisk(filename), () => ({}) as never).orElse(() => okAsync({}));
  },

  writeFile(path: string, data: Buffer | string): ResultAsync<void, IOError> {
    return ResultAsync.fromPromise(fs.writeFile(path, data), (cause): IOError => ({ type: 'FileWriteError', path, cause }));
  },
});
