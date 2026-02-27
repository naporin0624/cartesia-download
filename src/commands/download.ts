import path from 'node:path';
import { define } from 'gunshi';
import { okAsync, errAsync } from 'neverthrow';
import type { ResultAsync } from 'neverthrow';
import type { AppError, FileOutput, IO, RawCliArgs, ResolvedConfig, TextAnnotator, TtsClient } from '../types.js';
import { resolveConfig } from '../core/config.js';
import { createCartesiaTtsClient, type CartesiaLikeClient } from '../core/tts-client.js';
import { createFileOutput } from '../core/output.js';
import { createIO } from '../core/io.js';
import { CartesiaClient } from '@cartesia/cartesia-js';
import { createAnnotator } from '../core/annotator.js';
import { formatError } from '../core/format-error.js';

type DownloadDeps = {
  io: IO;
  ttsClient?: TtsClient;
  fileOutput?: FileOutput;
  annotator?: TextAnnotator;
  createTtsClient?: (apiKey: string) => TtsClient;
};

const resolveText = (args: RawCliArgs, io: IO): ResultAsync<RawCliArgs, AppError> => {
  if (args.input && !args.text) {
    return io.readTextFile(args.input).map((text) => ({ ...args, text }));
  }
  return okAsync(args);
};

const annotateText = (config: ResolvedConfig, args: RawCliArgs, annotator?: TextAnnotator): ResultAsync<ResolvedConfig, AppError> => {
  if (annotator && !args['no-annotate']) {
    return annotator.annotate(config.text).map((annotated) => ({ ...config, text: annotated }));
  }
  return okAsync(config);
};

const writeAnnotationFile = (config: ResolvedConfig, originalText: string, io: IO): ResultAsync<void, AppError> => {
  if (config.text !== originalText) {
    const parsed = path.parse(config.outputPath);
    const txtPath = path.join(parsed.dir, `${parsed.name}.txt`);
    return io.writeFile(txtPath, config.text);
  }
  return okAsync(undefined);
};

export const runDownload = (args: RawCliArgs, env: Record<string, string | undefined>, deps: DownloadDeps): ResultAsync<void, AppError> =>
  resolveText(args, deps.io)
    .andThen((resolvedArgs) =>
      deps.io.readRcFile('.cartesiarc.json').andThen((rc) => {
        const configResult = resolveConfig(resolvedArgs, env, rc);
        return configResult.isOk() ? okAsync(configResult.value) : errAsync(configResult.error);
      }),
    )
    .andThen((config) => {
      const originalText = config.text;
      return annotateText(config, args, deps.annotator).andThen((annotatedConfig) => writeAnnotationFile(annotatedConfig, originalText, deps.io).map(() => annotatedConfig));
    })
    .andThen((config) => {
      const ttsClient = deps.ttsClient ?? deps.createTtsClient!(config.apiKey);
      const fileOutput = deps.fileOutput ?? createFileOutput();
      return ttsClient.generate(config).andThen((result) => fileOutput.write(config.outputPath, result));
    });

export const downloadCommand = define({
  name: 'download',
  description: 'Generate audio from text using Cartesia TTS API',
  args: {
    input: { type: 'string', short: 'i', description: 'Path to text file' },
    text: { type: 'string', short: 't', description: 'Text to synthesize' },
    'voice-id': { type: 'string', description: 'Cartesia voice ID' },
    format: { type: 'string', short: 'f', default: 'wav', description: 'Output format (wav or mp3)' },
    output: { type: 'string', short: 'o', description: 'Output file path' },
    model: { type: 'string', short: 'm', default: 'sonic-3', description: 'Model ID' },
    'sample-rate': { type: 'number', default: 44100, description: 'Sample rate' },
    provider: { type: 'string', default: 'claude', description: 'LLM provider for emotion annotation (claude)' },
    'provider-model': { type: 'string', description: 'LLM model for emotion annotation (e.g. claude-sonnet-4-20250514)' },
    'provider-api-key': { type: 'string', description: 'API key for the LLM provider' },
    'no-annotate': { type: 'boolean', default: false, description: 'Skip emotion annotation' },
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

    const io = createIO();
    const rc = await io.readRcFile('.cartesiarc.json');
    const rcConfig = rc._unsafeUnwrap();

    const annotator: TextAnnotator | undefined = (() => {
      if (ctx.values['no-annotate']) {
        return undefined;
      }
      const provider = ctx.values.provider ?? rcConfig.provider ?? 'claude';
      const providerApiKey = ctx.values['provider-api-key'] ?? rcConfig.providerApiKey;
      const providerModel = ctx.values['provider-model'] ?? rcConfig.providerModel;
      const result = createAnnotator(provider, { apiKey: providerApiKey, model: providerModel });
      if (result.isErr()) {
        console.error(formatError(result.error));
        process.exit(1);
      }
      return result.value;
    })();

    await runDownload(args, process.env, {
      io,
      annotator,
      createTtsClient: (apiKey) => {
        const client = new CartesiaClient({ apiKey });
        return createCartesiaTtsClient(client as unknown as CartesiaLikeClient);
      },
    }).match(
      () => {
        console.log('Audio saved successfully');
      },
      (error) => {
        console.error(formatError(error));
        process.exit(1);
      },
    );
  },
});
