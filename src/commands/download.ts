import path from 'node:path';
import { define } from 'gunshi';
import type { CartesiaDownloadError, FileOutput, RawCliArgs, RcConfig, TextAnnotator, TtsClient } from '../types.js';
import { readRcFile, readTextFile, resolveConfig } from '../core/config.js';
import { createCartesiaTtsClient, type CartesiaLikeClient } from '../core/tts-client.js';
import { createFileOutput } from '../core/output.js';
import { CartesiaClient } from '@cartesia/cartesia-js';
import { createAnnotator } from '../core/annotator.js';

const isError = (value: unknown): value is CartesiaDownloadError => {
  return typeof value === 'object' && value !== null && 'type' in value;
};

export const runDownload = async (
  args: RawCliArgs,
  env: Record<string, string | undefined>,
  deps: {
    ttsClient?: TtsClient;
    fileOutput?: FileOutput;
    annotator?: TextAnnotator;
    createTtsClient?: (apiKey: string) => TtsClient;
    readTextFile: (path: string) => Promise<string | CartesiaDownloadError>;
    readRcFile: (path: string) => Promise<RcConfig>;
    writeTextFile?: (filePath: string, content: string) => Promise<void | CartesiaDownloadError>;
  },
): Promise<void | CartesiaDownloadError> => {
  // If --input is provided and --text is not, read text from file
  if (args.input && !args.text) {
    const textResult = await deps.readTextFile(args.input);
    if (isError(textResult)) {
      return textResult;
    }
    args = { ...args, text: textResult };
  }

  const rc = await deps.readRcFile('.cartesiarc.json');
  const config = resolveConfig(args, env, rc);
  if (isError(config)) {
    return config;
  }

  // Annotate text if annotator is provided and not skipped
  const resolvedConfig = await (async () => {
    if (deps.annotator && !args['no-annotate']) {
      const annotated = await deps.annotator.annotate(config.text);
      if (isError(annotated)) {
        return annotated;
      }
      // Save annotated text as .txt alongside the audio file
      if (deps.writeTextFile) {
        const parsed = path.parse(config.outputPath);
        const txtPath = path.join(parsed.dir, `${parsed.name}.txt`);
        const txtResult = await deps.writeTextFile(txtPath, annotated);
        if (isError(txtResult)) {
          return txtResult;
        }
      }
      return { ...config, text: annotated };
    }
    return config;
  })();
  if (isError(resolvedConfig)) {
    return resolvedConfig;
  }

  const ttsClient = deps.ttsClient ?? deps.createTtsClient!(resolvedConfig.apiKey);
  const fileOutput = deps.fileOutput ?? createFileOutput();

  const result = await ttsClient.generate(resolvedConfig);
  if (isError(result)) {
    return result;
  }

  const writeResult = await fileOutput.write(resolvedConfig.outputPath, result);
  if (writeResult) {
    return writeResult;
  }
  return undefined;
};

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
    provider: {
      type: 'string',
      default: 'claude',
      description: 'LLM provider for emotion annotation (claude)',
    },
    'provider-model': {
      type: 'string',
      description: 'LLM model for emotion annotation (e.g. claude-sonnet-4-20250514)',
    },
    'provider-api-key': {
      type: 'string',
      description: 'API key for the LLM provider',
    },
    'no-annotate': {
      type: 'boolean',
      default: false,
      description: 'Skip emotion annotation',
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
      provider: ctx.values.provider,
      'provider-model': ctx.values['provider-model'],
      'provider-api-key': ctx.values['provider-api-key'],
      'no-annotate': ctx.values['no-annotate'],
    };

    const noAnnotate = ctx.values['no-annotate'];
    const rc = await readRcFile('.cartesiarc.json');
    const annotator: TextAnnotator | undefined = (() => {
      if (noAnnotate) {
        return undefined;
      }
      const provider = ctx.values.provider ?? rc.provider ?? 'claude';
      const providerApiKey = ctx.values['provider-api-key'] ?? rc.providerApiKey;
      const providerModel = ctx.values['provider-model'] ?? rc.providerModel;
      const annotatorResult = createAnnotator(provider, { apiKey: providerApiKey, model: providerModel });
      if (isError(annotatorResult)) {
        console.error(`Error: ${annotatorResult.type}`);
        process.exit(1);
      }
      return annotatorResult;
    })();

    const result = await runDownload(args, process.env, {
      annotator,
      createTtsClient: (apiKey) => {
        const client = new CartesiaClient({ apiKey });
        return createCartesiaTtsClient(client as unknown as CartesiaLikeClient);
      },
      readTextFile,
      readRcFile,
      writeTextFile: async (filePath, content) => {
        try {
          const fs = await import('node:fs/promises');
          await fs.writeFile(filePath, content, 'utf-8');
        } catch (cause) {
          return { type: 'FileWriteError', path: filePath, cause };
        }
      },
    });
    if (result) {
      console.error(`Error: ${result.type}`);
      process.exit(1);
    }

    console.log('Audio saved successfully');
  },
});
