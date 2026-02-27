import fs from 'node:fs/promises'
import type {
  AudioFormat,
  CartesiaDownloadError,
  RawCliArgs,
  RcConfig,
  ResolvedConfig,
} from '../types.js'

export const parseFormat = (value: string): AudioFormat | CartesiaDownloadError => {
  const lower = value.toLowerCase()
  if (lower === 'wav' || lower === 'mp3') {
    return lower
  }
  return { type: 'InvalidFormat', value }
}

export const resolveConfig = (
  args: RawCliArgs,
  env: Record<string, string | undefined>,
  rc: RcConfig,
): ResolvedConfig | CartesiaDownloadError => {
  // Resolve apiKey: env > rc (no CLI arg for apiKey)
  const apiKey = env['CARTESIA_API_KEY'] ?? rc.apiKey
  if (!apiKey) {
    return { type: 'MissingApiKey' }
  }

  // Resolve voiceId: CLI > env > rc
  const voiceId = args['voice-id'] ?? env['CARTESIA_VOICE_ID'] ?? rc.voiceId
  if (!voiceId) {
    return { type: 'MissingVoiceId' }
  }

  // Resolve text: CLI args only
  const text = args.text
  if (!text) {
    return { type: 'MissingText' }
  }

  // Resolve outputPath: CLI > rc
  const outputPath = args.output ?? rc.outputPath
  if (!outputPath) {
    return { type: 'MissingOutput' }
  }

  // Resolve format: CLI > rc > default
  const rawFormat = args.format ?? rc.format ?? 'wav'
  const format = parseFormat(rawFormat)
  if (typeof format === 'object' && 'type' in format) {
    return format
  }

  // Resolve model: CLI > rc > default
  const model = args.model ?? rc.model ?? 'sonic-3'

  // Resolve sampleRate: CLI > rc > default
  const sampleRate = args['sample-rate'] ?? rc.sampleRate ?? 44100

  return {
    apiKey,
    voiceId,
    model,
    sampleRate,
    format,
    outputPath,
    text,
  }
}

export const readRcFile = async (path: string): Promise<RcConfig> => {
  try {
    const content = await fs.readFile(path, 'utf-8')
    return JSON.parse(content) as RcConfig
  } catch {
    return {}
  }
}

export const readTextFile = async (path: string): Promise<string | CartesiaDownloadError> => {
  try {
    return await fs.readFile(path, 'utf-8')
  } catch (cause) {
    return { type: 'FileReadError', path, cause }
  }
}
