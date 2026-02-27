import path from 'node:path';
import { define } from 'gunshi';
import { okAsync, errAsync, ResultAsync } from 'neverthrow';
import type { AppError, IO, RawCliArgs, TextAnnotator, TtsClient } from '../types.js';
import { resolveConfig } from '../core/config.js';
import { createCartesiaTtsClient, type CartesiaLikeClient } from '../core/tts-client.js';
import { createIO } from '../core/io.js';
import { CartesiaClient } from '@cartesia/cartesia-js';
import { createAnnotator } from '../core/annotator.js';
import { formatError } from '../core/format-error.js';
import { splitSentences } from '../core/sentence-splitter.js';
import { runStreamingPipeline } from '../core/pipeline.js';
import { buildWavHeader } from '../core/wav.js';

type DownloadDeps = {
  io: IO;
  ttsClient?: TtsClient;
  annotator?: TextAnnotator;
  createTtsClient?: (apiKey: string) => TtsClient;
  stdout?: NodeJS.WritableStream;
};

const resolveText = (args: RawCliArgs, io: IO): ResultAsync<RawCliArgs, AppError> => {
  if (args.input && !args.text) {
    return io.readTextFile(args.input).map((text) => ({ ...args, text }));
  }
  return okAsync(args);
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
      const ttsClient = deps.ttsClient ?? deps.createTtsClient!(config.apiKey);
      const sentences = splitSentences(config.text);
      const stdout = deps.stdout ?? process.stdout;
      const effectiveAnnotator = args['no-annotate'] ? undefined : deps.annotator;

      return ResultAsync.fromPromise(
        runStreamingPipeline(sentences, config, ttsClient, effectiveAnnotator, (chunk) => {
          stdout.write(chunk);
        }),
        (cause): AppError => ({ type: 'TtsApiError', cause }),
      ).andThen((pipelineResult) => {
        if (pipelineResult.isErr()) return errAsync(pipelineResult.error);

        const { chunks, annotatedTexts } = pipelineResult.value;
        const tasks: ResultAsync<void, AppError>[] = [];

        // Save WAV file if --output specified
        if (config.outputPath) {
          const pcmData = Buffer.concat(chunks.map((c) => Buffer.from(c)));
          const header = buildWavHeader({
            dataByteLength: pcmData.byteLength,
            sampleRate: config.sampleRate,
            numChannels: 1,
            bitsPerSample: 16,
          });
          tasks.push(deps.io.writeFile(config.outputPath, Buffer.concat([header, pcmData])));
        }

        // Save annotation file if text was annotated
        const originalText = config.text;
        const annotatedText = annotatedTexts.join('');
        if (annotatedText !== originalText && config.outputPath) {
          const parsed = path.parse(config.outputPath);
          const txtPath = path.join(parsed.dir, `${parsed.name}.txt`);
          tasks.push(deps.io.writeFile(txtPath, annotatedText));
        }

        return tasks.length > 0 ? ResultAsync.combine(tasks).map(() => undefined) : okAsync(undefined);
      });
    });

export const downloadCommand = define({
  name: 'download',
  description: 'Generate audio from text using Cartesia TTS API. Streams raw PCM to stdout.',
  args: {
    input: { type: 'string', short: 'i', description: 'Path to text file' },
    text: { type: 'string', short: 't', description: 'Text to synthesize' },
    'voice-id': { type: 'string', description: 'Cartesia voice ID' },
    output: { type: 'string', short: 'o', description: 'Output WAV file path (optional)' },
    model: { type: 'string', short: 'm', default: 'sonic-3', description: 'Model ID' },
    'sample-rate': { type: 'number', default: 44100, description: 'Sample rate' },
    provider: { type: 'string', default: 'claude', description: 'LLM provider for emotion annotation (claude)' },
    'provider-model': { type: 'string', description: 'LLM model for emotion annotation (e.g. claude-sonnet-4-20250514)' },
    'provider-api-key': { type: 'string', description: 'API key for the LLM provider' },
    'no-annotate': { type: 'boolean', default: false, description: 'Skip emotion annotation' },
  },
  examples: `
# Stream audio to stdout and save WAV
$ cartesia-download --text "こんにちは" --voice-id xxx --output hello.wav

# Stream raw PCM to audio player
$ cartesia-download --text "テスト。" --voice-id xxx | aplay -f S16_LE -r 44100 -c 1
`,
  run: async (ctx) => {
    const args: RawCliArgs = {
      input: ctx.values.input,
      text: ctx.values.text,
      'voice-id': ctx.values['voice-id'],
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
        console.error('Done');
      },
      (error) => {
        console.error(formatError(error));
        process.exit(1);
      },
    );
  },
});
