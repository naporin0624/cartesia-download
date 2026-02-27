import { describe, it, expect, vi } from 'vitest'
import { buildOutputFormat, createCartesiaTtsClient } from './tts-client.js'
import type { ResolvedConfig, TtsResult, CartesiaDownloadError } from '../types.js'

const baseConfig: ResolvedConfig = {
  apiKey: 'test-api-key',
  voiceId: 'test-voice-id',
  model: 'sonic-3',
  sampleRate: 44100,
  format: 'wav',
  outputPath: '/tmp/output.wav',
  text: 'Hello, world!',
}

async function* createMockAsyncIterable(data: Buffer): AsyncIterable<Uint8Array> {
  yield new Uint8Array(data)
}

describe('buildOutputFormat', () => {
  it('returns WAV format with pcm_s16le encoding', () => {
    const result = buildOutputFormat('wav', 44100)
    expect(result).toEqual({
      container: 'wav',
      sampleRate: 44100,
      encoding: 'pcm_s16le',
    })
  })

  it('returns MP3 format with bitRate 128000', () => {
    const result = buildOutputFormat('mp3', 44100)
    expect(result).toEqual({
      container: 'mp3',
      sampleRate: 44100,
      bitRate: 128000,
    })
  })

  it('respects different sample rates for WAV', () => {
    const result = buildOutputFormat('wav', 22050)
    expect(result).toEqual({
      container: 'wav',
      sampleRate: 22050,
      encoding: 'pcm_s16le',
    })
  })

  it('respects different sample rates for MP3', () => {
    const result = buildOutputFormat('mp3', 22050)
    expect(result).toEqual({
      container: 'mp3',
      sampleRate: 22050,
      bitRate: 128000,
    })
  })
})

describe('createCartesiaTtsClient', () => {
  it('calls client.tts.bytes with correct parameters and returns TtsResult', async () => {
    const fakeAudioData = Buffer.from('fake-audio-data')
    const mockClient = {
      tts: {
        bytes: vi.fn().mockResolvedValue(createMockAsyncIterable(fakeAudioData)),
      },
    }

    const ttsClient = createCartesiaTtsClient(mockClient)
    const result = await ttsClient.generate(baseConfig)

    expect(mockClient.tts.bytes).toHaveBeenCalledOnce()
    expect(mockClient.tts.bytes).toHaveBeenCalledWith({
      modelId: 'sonic-3',
      transcript: 'Hello, world!',
      voice: { mode: 'id', id: 'test-voice-id' },
      language: 'ja',
      outputFormat: {
        container: 'wav',
        sampleRate: 44100,
        encoding: 'pcm_s16le',
      },
    })

    const ttsResult = result as TtsResult
    expect(Buffer.from(ttsResult.audioData)).toEqual(fakeAudioData)
    expect(ttsResult.format).toBe('wav')
  })

  it('passes MP3 output format when config format is mp3', async () => {
    const fakeAudioData = Buffer.from('fake-mp3-data')
    const mockClient = {
      tts: {
        bytes: vi.fn().mockResolvedValue(createMockAsyncIterable(fakeAudioData)),
      },
    }

    const mp3Config: ResolvedConfig = { ...baseConfig, format: 'mp3', outputPath: '/tmp/output.mp3' }
    const ttsClient = createCartesiaTtsClient(mockClient)
    const result = await ttsClient.generate(mp3Config)

    expect(mockClient.tts.bytes).toHaveBeenCalledWith(
      expect.objectContaining({
        outputFormat: {
          container: 'mp3',
          sampleRate: 44100,
          bitRate: 128000,
        },
      }),
    )

    const ttsResult = result as TtsResult
    expect(Buffer.from(ttsResult.audioData)).toEqual(fakeAudioData)
    expect(ttsResult.format).toBe('mp3')
  })

  it('returns TtsApiError when client.tts.bytes throws', async () => {
    const apiError = new Error('API rate limit exceeded')
    const mockClient = {
      tts: {
        bytes: vi.fn().mockRejectedValue(apiError),
      },
    }

    const ttsClient = createCartesiaTtsClient(mockClient)
    const result = await ttsClient.generate(baseConfig)

    const error = result as CartesiaDownloadError
    expect(error.type).toBe('TtsApiError')
    expect((error as { type: 'TtsApiError'; cause: unknown }).cause).toBe(apiError)
  })

  it('returns TtsApiError when async iteration fails', async () => {
    async function* brokenIterable(): AsyncIterable<Uint8Array> {
      throw new Error('Stream read error')
    }
    const mockClient = {
      tts: {
        bytes: vi.fn().mockResolvedValue(brokenIterable()),
      },
    }

    const ttsClient = createCartesiaTtsClient(mockClient)
    const result = await ttsClient.generate(baseConfig)

    const error = result as CartesiaDownloadError
    expect(error.type).toBe('TtsApiError')
  })
})
