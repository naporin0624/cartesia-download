import { Hono } from 'hono';
import type { SettingsService } from '@shared/plugins/settings/service';
import type { TtsService } from '@shared/plugins/tts/service';
import type { HistoryService } from '@shared/plugins/history/service';
import { settingsRoutes } from '@shared/plugins/settings/routes';
import { ttsRoutes } from '@shared/plugins/tts/routes';
import { historyRoutes } from '@shared/plugins/history/routes';

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface Services {
  settings: SettingsService;
  tts: TtsService;
  history: HistoryService;
}

export interface HonoEnv {
  Variables: {
    services: Services;
    logger: Logger;
  };
}

const defaultLogger: Logger = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

export const createApp = (deps: { services: Services; logger?: Logger }) => {
  const log = deps.logger ?? defaultLogger;

  return new Hono<HonoEnv>()
    .use('*', async (c, next) => {
      c.set('services', deps.services);
      c.set('logger', log);

      const start = Date.now();
      log.debug(`--> ${c.req.method} ${c.req.url}`);

      await next();

      const ms = Date.now() - start;
      log.debug(`<-- ${c.req.method} ${c.req.url} ${c.res.status} ${ms}ms`);
    })
    .route('/settings', settingsRoutes)
    .route('/tts', ttsRoutes)
    .route('/history', historyRoutes)
    .onError((err, c) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const stack = err instanceof Error ? err.stack : undefined;
      c.var.logger.error(`[hono:error] ${c.req.method} ${c.req.url}`, message, stack);
      return c.json({ error: message }, 500);
    });
};
