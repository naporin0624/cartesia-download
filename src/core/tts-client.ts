import type { AudioFormat, ResolvedConfig, TtsClient, TtsResult, CartesiaDownloadError } from '../types.js'

type WavOutputFormat = {
  container: 'wav'
  sampleRate: number
  encoding: 'pcm_s16le'
}

type Mp3OutputFormat = {
  container: 'mp3'
  sampleRate: number
  bitRate: number
}

type OutputFormat = WavOutputFormat | Mp3OutputFormat

export const buildOutputFormat = (format: AudioFormat, sampleRate: number): OutputFormat => {
  if (format === 'wav') {
    return {
      container: 'wav',
      sampleRate,
      encoding: 'pcm_s16le',
    }
  }

  return {
    container: 'mp3',
    sampleRate,
    bitRate: 128000,
  }
}

export interface CartesiaLikeClient {
  tts: {
    bytes: (params: {
      modelId: string
      transcript: string
      voice: { mode: 'id'; id: string }
      language?: string
      outputFormat: OutputFormat
    }) => Promise<AsyncIterable<Uint8Array>>
  }
}

const asyncIterableToBuffer = async (iterable: AsyncIterable<Uint8Array>): Promise<Buffer> => {
  const chunks: Buffer[] = []
  for await (const chunk of iterable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export const createCartesiaTtsClient = (client: CartesiaLikeClient): TtsClient => ({
  async generate(config: ResolvedConfig): Promise<TtsResult | CartesiaDownloadError> {
    try {
      const outputFormat = buildOutputFormat(config.format, config.sampleRate)

      const response = await client.tts.bytes({
        modelId: config.model,
        transcript: config.text,
        voice: { mode: 'id', id: config.voiceId },
        language: 'ja',
        outputFormat,
      })

      const buffer = await asyncIterableToBuffer(response)

      const arrayBuffer = new ArrayBuffer(buffer.byteLength)
      new Uint8Array(arrayBuffer).set(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength))

      return {
        audioData: arrayBuffer,
        format: config.format,
      }
    } catch (cause) {
      return { type: 'TtsApiError', cause }
    }
  },
})
