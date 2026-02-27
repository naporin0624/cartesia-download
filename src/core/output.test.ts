import { describe, it, expect, vi } from 'vitest'
import type { TtsResult } from '../types.js'

vi.mock('node:fs/promises')

import fs from 'node:fs/promises'

import { createFileOutput } from './output.js'

describe('createFileOutput', () => {
  const result: TtsResult = {
    audioData: new Uint8Array([0x52, 0x49, 0x46, 0x46]).buffer,
    format: 'wav',
  }

  it('writes audio data to the specified path as a Buffer', async () => {
    vi.mocked(fs.writeFile).mockResolvedValue(undefined)

    const output = createFileOutput()
    const writeResult = await output.write('/tmp/test.wav', result)

    expect(writeResult).toBeUndefined()
    expect(fs.writeFile).toHaveBeenCalledOnce()
    expect(fs.writeFile).toHaveBeenCalledWith(
      '/tmp/test.wav',
      Buffer.from(result.audioData),
    )
  })

  it('returns FileWriteError when fs.writeFile throws', async () => {
    const cause = new Error('disk full')
    vi.mocked(fs.writeFile).mockRejectedValue(cause)

    const output = createFileOutput()
    const writeResult = await output.write('/tmp/fail.mp3', result)

    expect(writeResult).toEqual({
      type: 'FileWriteError',
      path: '/tmp/fail.mp3',
      cause,
    })
  })
})
