import { Hono } from 'hono';
import type { HonoEnv } from '@shared/callable/index';

export const historyRoutes = new Hono<HonoEnv>()
  .get('/', (c) => {
    try {
      const entries = c.var.services.history.list();
      return c.json(entries);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      c.var.logger.error('[history:list] error', { error: message });
      return c.json({ error: message }, 500);
    }
  })
  .delete('/:id', (c) => {
    const id = c.req.param('id');
    try {
      c.var.services.history.remove(id);
      return c.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      c.var.logger.error('[history:delete] error', { error: message });
      return c.json({ error: message }, 500);
    }
  })
  .get('/:id/audio', (c) => {
    const id = c.req.param('id');
    try {
      const wav = c.var.services.history.getAudio(id);
      const base64 = Buffer.from(wav).toString('base64');
      return c.json({ wav: base64 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      c.var.logger.error('[history:audio] error', { error: message });
      return c.json({ error: message }, 404);
    }
  });
