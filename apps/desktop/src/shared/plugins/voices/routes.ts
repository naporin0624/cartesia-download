import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoEnv } from '@shared/callable/index';

const UpdateVoiceBody = z.object({
  name: z.string(),
  description: z.string(),
  isPublic: z.boolean(),
});

export const voicesRoutes = new Hono<HonoEnv>()
  .get('/', async (c) => {
    try {
      const entries = await c.var.services.voices.list();

      const presets = c.var.services.settings.get().presets;
      const existingVoiceIds = new Set(presets.map((p) => p.voiceId));
      for (const voice of entries) {
        if (!existingVoiceIds.has(voice.id)) {
          const id = crypto.randomUUID();
          c.var.services.settings.addPreset({ id, name: voice.name, voiceId: voice.id, systemPrompt: '' });
          c.var.logger.info('[voices:list] auto-added preset', { voiceId: voice.id, name: voice.name });
        }
      }

      return c.json(entries);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      c.var.logger.error('[voices:list] error', { error: message });
      return c.json({ error: message }, 500);
    }
  })
  .patch('/:id', zValidator('json', UpdateVoiceBody), async (c) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');
    try {
      await c.var.services.voices.update(id, body);
      return c.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      c.var.logger.error('[voices:update] error', { error: message });
      return c.json({ error: message }, 500);
    }
  });
