import { describe, it, expect, vi } from 'vitest'
import { runDownload } from './download.js'
import type { TtsClient, FileOutput, TtsResult, CartesiaDownloadError } from '../types.js'

function createMockTtsClient(result: TtsResult | CartesiaDownloadError): TtsClient {
  return { generate: vi.fn().mockResolvedValue(result) }
}

function createMockFileOutput(result?: CartesiaDownloadError): FileOutput {
  return { write: vi.fn().mockResolvedValue(result) }
}

const audioData = new ArrayBuffer(16)

function createMockDeps(overrides?: {
  ttsClient?: TtsClient
  fileOutput?: FileOutput
  readTextFile?: ReturnType<typeof vi.fn>
  readRcFile?: ReturnType<typeof vi.fn>
}) {
  return {
    ttsClient: overrides?.ttsClient ?? createMockTtsClient({ audioData, format: 'wav' }),
    fileOutput: overrides?.fileOutput ?? createMockFileOutput(),
    readTextFile: overrides?.readTextFile ?? vi.fn().mockResolvedValue('file content'),
    readRcFile: overrides?.readRcFile ?? vi.fn().mockResolvedValue({}),
  }
}

describe('runDownload', () => {
  it('generates audio and writes to file with --text', async () => {
    const ttsResult: TtsResult = { audioData, format: 'wav' }
    const ttsClient = createMockTtsClient(ttsResult)
    const fileOutput = createMockFileOutput()

    const result = await runDownload(
      { text: 'hello', 'voice-id': 'v1', output: 'out.wav' },
      { CARTESIA_API_KEY: 'key1' },
      createMockDeps({ ttsClient, fileOutput }),
    )

    expect(result).toBeUndefined()
    expect(ttsClient.generate).toHaveBeenCalledOnce()
    expect(fileOutput.write).toHaveBeenCalledWith('out.wav', ttsResult)
  })

  it('reads text from --input file', async () => {
    const ttsResult: TtsResult = { audioData, format: 'wav' }
    const ttsClient = createMockTtsClient(ttsResult)
    const fileOutput = createMockFileOutput()

    const result = await runDownload(
      { input: '/tmp/test-input.txt', 'voice-id': 'v1', output: 'out.wav' },
      { CARTESIA_API_KEY: 'key1' },
      createMockDeps({
        ttsClient,
        fileOutput,
        readTextFile: vi.fn().mockResolvedValue('file content'),
      }),
    )

    expect(result).toBeUndefined()
    expect(ttsClient.generate).toHaveBeenCalledOnce()
    const config = (ttsClient.generate as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(config.text).toBe('file content')
  })

  it('returns error when --input file read fails', async () => {
    const ttsClient = createMockTtsClient({ audioData, format: 'wav' })
    const fileReadError: CartesiaDownloadError = {
      type: 'FileReadError',
      path: '/tmp/missing.txt',
      cause: new Error('ENOENT'),
    }

    const result = await runDownload(
      { input: '/tmp/missing.txt', 'voice-id': 'v1', output: 'out.wav' },
      { CARTESIA_API_KEY: 'key1' },
      createMockDeps({
        ttsClient,
        readTextFile: vi.fn().mockResolvedValue(fileReadError),
      }),
    )

    expect(result).toEqual(fileReadError)
    expect(ttsClient.generate).not.toHaveBeenCalled()
  })

  it('returns error when config resolution fails (missing apiKey)', async () => {
    const result = await runDownload(
      { text: 'hello', 'voice-id': 'v1', output: 'out.wav' },
      {},
      createMockDeps(),
    )

    expect(result).toEqual({ type: 'MissingApiKey' })
  })

  it('returns error when TTS generation fails', async () => {
    const apiError: CartesiaDownloadError = { type: 'TtsApiError', cause: new Error('API down') }
    const ttsClient = createMockTtsClient(apiError)

    const result = await runDownload(
      { text: 'hello', 'voice-id': 'v1', output: 'out.wav' },
      { CARTESIA_API_KEY: 'key1' },
      createMockDeps({ ttsClient }),
    )

    expect(result).toEqual(apiError)
  })

  it('returns error when file write fails', async () => {
    const ttsResult: TtsResult = { audioData, format: 'wav' }
    const writeError: CartesiaDownloadError = {
      type: 'FileWriteError',
      path: 'out.wav',
      cause: new Error('disk full'),
    }
    const ttsClient = createMockTtsClient(ttsResult)
    const fileOutput = createMockFileOutput(writeError)

    const result = await runDownload(
      { text: 'hello', 'voice-id': 'v1', output: 'out.wav' },
      { CARTESIA_API_KEY: 'key1' },
      createMockDeps({ ttsClient, fileOutput }),
    )

    expect(result).toEqual(writeError)
  })

  it('prefers --text over --input when both provided', async () => {
    const ttsResult: TtsResult = { audioData, format: 'wav' }
    const ttsClient = createMockTtsClient(ttsResult)
    const readTextFile = vi.fn().mockResolvedValue('from file')

    const result = await runDownload(
      { text: 'from cli', input: '/tmp/file.txt', 'voice-id': 'v1', output: 'out.wav' },
      { CARTESIA_API_KEY: 'key1' },
      createMockDeps({ ttsClient, readTextFile }),
    )

    expect(result).toBeUndefined()
    expect(readTextFile).not.toHaveBeenCalled()
    const config = (ttsClient.generate as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(config.text).toBe('from cli')
  })
})
