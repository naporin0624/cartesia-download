import path from 'node:path';
import { define } from 'gunshi';
import { okAsync, errAsync, ResultAsync, type Result } from 'neverthrow';
import type { CartesiaDownloadError, FileOutput, RawCliArgs, RcConfig, ResolvedConfig, TextAnnotator, TtsClient } from '../types.js';
import { readRcFile, readTextFile, resolveConfig } from '../core/config.js';
import { createCartesiaTtsClient, type CartesiaLikeClient } from '../core/tts-client.js';
import { createFileOutput } from '../core/output.js';
import { CartesiaClient } from '@cartesia/cartesia-js';
import { createAnnotator } from '../core/annotator.js';

type DownloadDeps = {
  ttsClient?: TtsClient;
  fileOutput?: FileOutput;
  annotator?: TextAnnotator;
  createTtsClient?: (apiKey: string) => TtsClient;
  readTextFile: (filePath: string) => ResultAsync<string, CartesiaDownloadError>;
  readRcFile: (path: string) => Promise<RcConfig>;
  writeTextFile?: (filePath: string, content: string) => ResultAsync<void, CartesiaDownloadError>;
};

const resolveText = (args: RawCliArgs, deps: DownloadDeps): ResultAsync<RawCliArgs, CartesiaDownloadError> => {
  if (args.input && !args.text) {
    return deps.readTextFile(args.input).map((text) => ({ ...args, text }));
  }
  return okAsync(args);
};

const annotateText = (config: ResolvedConfig, args: RawCliArgs, deps: DownloadDeps): ResultAsync<ResolvedConfig, CartesiaDownloadError> => {
  if (deps.annotator && !args['no-annotate']) {
    return deps.annotator.annotate(config.text).andThen((annotated) => {
      if (deps.writeTextFile) {
        const parsed = path.parse(config.outputPath);
        const txtPath = path.join(parsed.dir, `${parsed.name}.txt`);
        return deps.writeTextFile(txtPath, annotated).map(() => ({ ...config, text: annotated }));
      }
      return okAsync({ ...config, text: annotated });
    });
  }
  return okAsync(config);
};

const fromResult = <T>(result: Result<T, CartesiaDownloadError>): ResultAsync<T, CartesiaDownloadError> => (result.isOk() ? okAsync(result.value) : errAsync(result.error));

export const runDownload = (args: RawCliArgs, env: Record<string, string | undefined>, deps: DownloadDeps): ResultAsync<void, CartesiaDownloadError> =>
  resolveText(args, deps)
    .andThen((resolvedArgs) => ResultAsync.fromSafePromise<RcConfig, CartesiaDownloadError>(deps.readRcFile('.cartesiarc.json')).andThen((rc) => fromResult(resolveConfig(resolvedArgs, env, rc))))
    .andThen((config) => annotateText(config, args, deps))
    .andThen((config) => {
      const ttsClient = deps.ttsClient ?? deps.createTtsClient!(config.apiKey);
      const fileOutput = deps.fileOutput ?? createFileOutput();
      return ttsClient.generate(config).andThen((result) => fileOutput.write(config.outputPath, result));
    });

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
      if (annotatorResult.isErr()) {
        console.error(`Error: ${annotatorResult.error.type}`);
        process.exit(1);
      }
      return annotatorResult.value;
    })();

    const writeTextFile = (filePath: string, content: string): ResultAsync<void, CartesiaDownloadError> =>
      ResultAsync.fromPromise(
        (async () => {
          const fs = await import('node:fs/promises');
          await fs.writeFile(filePath, content, 'utf-8');
        })(),
        (cause): CartesiaDownloadError => ({ type: 'FileWriteError', path: filePath, cause }),
      );

    await runDownload(args, process.env, {
      annotator,
      createTtsClient: (apiKey) => {
        const client = new CartesiaClient({ apiKey });
        return createCartesiaTtsClient(client as unknown as CartesiaLikeClient);
      },
      readTextFile,
      readRcFile,
      writeTextFile,
    }).match(
      () => {
        console.log('Audio saved successfully');
      },
      (error) => {
        console.error(`Error: ${error.type}`);
        process.exit(1);
      },
    );
  },
});
