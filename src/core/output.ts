import fs from 'node:fs/promises'
import type { CartesiaDownloadError, FileOutput, TtsResult } from '../types.js'

export const createFileOutput = (): FileOutput => ({
  async write(path: string, result: TtsResult): Promise<void | CartesiaDownloadError> {
    try {
      await fs.writeFile(path, Buffer.from(result.audioData))
    } catch (cause) {
      return { type: 'FileWriteError', path, cause }
    }
  },
})
