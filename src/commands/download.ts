import { define } from 'gunshi'
import type { CartesiaDownloadError, FileOutput, RawCliArgs, RcConfig, TtsClient } from '../types.js'
import { readRcFile, readTextFile, resolveConfig } from '../core/config.js'
import { createCartesiaTtsClient, type CartesiaLikeClient } from '../core/tts-client.js'
import { createFileOutput } from '../core/output.js'
import { CartesiaClient } from '@cartesia/cartesia-js'

function isError(value: unknown): value is CartesiaDownloadError {
  return typeof value === 'object' && value !== null && 'type' in value
}

export async function runDownload(
  args: RawCliArgs,
  env: Record<string, string | undefined>,
  deps: {
    ttsClient?: TtsClient
    fileOutput?: FileOutput
    createTtsClient?: (apiKey: string) => TtsClient
    readTextFile: (path: string) => Promise<string | CartesiaDownloadError>
    readRcFile: (path: string) => Promise<RcConfig>
  },
): Promise<void | CartesiaDownloadError> {
  // If --input is provided and --text is not, read text from file
  if (args.input && !args.text) {
    const textResult = await deps.readTextFile(args.input)
    if (isError(textResult)) {
      return textResult
    }
    args = { ...args, text: textResult }
  }

  const rc = await deps.readRcFile('.cartesiarc.json')
  const config = resolveConfig(args, env, rc)
  if (isError(config)) {
    return config
  }

  const ttsClient = deps.ttsClient ?? deps.createTtsClient!(config.apiKey)
  const fileOutput = deps.fileOutput ?? createFileOutput()

  const result = await ttsClient.generate(config)
  if (isError(result)) {
    return result
  }

  const writeResult = await fileOutput.write(config.outputPath, result)
  if (writeResult) {
    return writeResult
  }
}

export const downloadCommand = define({
  name: 'download',
  description: 'Generate audio from text using Cartesia TTS API',
  args: {
    input: {
      type: 'string',
      short: 'i',
      description: 'Path to text file',
    },
    text: {
      type: 'string',
      short: 't',
      description: 'Text to synthesize',
    },
    'voice-id': {
      type: 'string',
      description: 'Cartesia voice ID',
    },
    format: {
      type: 'string',
      short: 'f',
      default: 'wav',
      description: 'Output format (wav or mp3)',
    },
    output: {
      type: 'string',
      short: 'o',
      description: 'Output file path',
    },
    model: {
      type: 'string',
      short: 'm',
      default: 'sonic-3',
      description: 'Model ID',
    },
    'sample-rate': {
      type: 'number',
      default: 44100,
      description: 'Sample rate',
    },
  },
  examples: `
# Generate WAV from text
$ cartesia-download --text "こんにちは" --voice-id xxx --output hello.wav

# Generate MP3 from file
$ cartesia-download --input script.txt --voice-id xxx --format mp3 --output hello.mp3
`,
  run: async (ctx) => {
    const args: RawCliArgs = {
      input: ctx.values.input,
      text: ctx.values.text,
      'voice-id': ctx.values['voice-id'],
      format: ctx.values.format,
      output: ctx.values.output,
      model: ctx.values.model,
      'sample-rate': ctx.values['sample-rate'],
    }

    const result = await runDownload(args, process.env, {
      createTtsClient: (apiKey) => {
        const client = new CartesiaClient({ apiKey })
        return createCartesiaTtsClient(client as unknown as CartesiaLikeClient)
      },
      readTextFile,
      readRcFile,
    })
    if (result) {
      console.error(`Error: ${result.type}`)
      process.exit(1)
    }

    console.log('Audio saved successfully')
  },
})
