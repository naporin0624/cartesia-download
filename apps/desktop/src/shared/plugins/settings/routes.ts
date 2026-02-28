import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoEnv } from '@shared/callable/index';

const UpdateSettingsBody = z.object({
  cartesiaApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  model: z.string().optional(),
  sampleRate: z.number().optional(),
  language: z.string().optional(),
  annotate: z.boolean().optional(),
});

const AddPresetBody = z.object({
  name: z.string().min(1),
  voiceId: z.string().min(1),
  systemPrompt: z.string(),
});

const UpdatePresetBody = z.object({
  name: z.string().min(1).optional(),
  voiceId: z.string().min(1).optional(),
  systemPrompt: z.string().optional(),
});

export const settingsRoutes = new Hono<HonoEnv>()
  .get('/', (c) => {
    const settings = c.var.services.settings.get();
    return c.json(settings);
  })
  .put('/', zValidator('json', UpdateSettingsBody), (c) => {
    const body = c.req.valid('json');
    c.var.services.settings.update(body);
    return c.json({ ok: true });
  })
  .post('/presets', zValidator('json', AddPresetBody), (c) => {
    const body = c.req.valid('json');
    const id = crypto.randomUUID();
    c.var.services.settings.addPreset({ id, ...body });
    return c.json({ id });
  })
  .put('/presets/:id', zValidator('json', UpdatePresetBody), (c) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');
    c.var.services.settings.updatePreset(id, body);
    return c.json({ ok: true });
  })
  .delete('/presets/:id', (c) => {
    const id = c.req.param('id');
    c.var.services.settings.deletePreset(id);
    return c.json({ ok: true });
  });
