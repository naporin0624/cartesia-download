import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoEnv } from '@shared/callable/index';

const GenerateBody = z.object({
  text: z.string().min(1),
  options: z.object({
    voiceId: z.string().min(1),
    model: z.string().min(1),
    sampleRate: z.number().int().positive(),
    language: z.string().min(1),
    annotate: z.boolean(),
    systemPrompt: z.string().optional(),
    presetName: z.string(),
  }),
});

export const ttsRoutes = new Hono<HonoEnv>().post('/generate', zValidator('json', GenerateBody), async (c) => {
  const { text, options } = c.req.valid('json');
  c.var.logger.info('[tts:generate] start', { textLength: text.length, annotate: options.annotate, model: options.model });

  try {
    const start = Date.now();
    const result = await c.var.services.tts.generate(text, options);
    const ms = Date.now() - start;

    c.var.logger.info('[tts:generate] done', { wavSize: result.wav.byteLength, hasAnnotation: result.annotatedText !== undefined, ms });

    const durationSec = (result.wav.byteLength - 44) / (options.sampleRate * 1 * 2);
    const historyEntry = c.var.services.history.add(
      {
        text,
        filePath: '',
        durationSec,
        presetName: options.presetName,
      },
      result.wav,
    );
    return c.json({ historyEntry });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    c.var.logger.error('[tts:generate] error', { error: message });
    return c.json({ error: message }, 500);
  }
});
