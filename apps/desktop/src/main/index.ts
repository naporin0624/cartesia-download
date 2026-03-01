import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { is, optimizer } from '@electron-toolkit/utils';
import { createApp } from '@shared/callable/index';
import { logger } from './adapters/logger';
import { createSettingsService } from './plugins/settings/service';
import { createTtsServiceFactory } from './plugins/tts/service';
import { createHistoryService } from './plugins/history/service';
import { createVoicesService } from './plugins/voices/service';

// Global error handlers
process.on('uncaughtException', (err: Error) => {
  logger.error('[main] uncaughtException', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  logger.error('[main] unhandledRejection', reason instanceof Error ? reason.message : reason, reason instanceof Error ? reason.stack : undefined);
});

const settingsService = createSettingsService();
const ttsService = createTtsServiceFactory(() => {
  const s = settingsService.get();
  return { cartesiaApiKey: s.cartesiaApiKey, anthropicApiKey: s.anthropicApiKey };
}, logger);
const historyService = createHistoryService(join(app.getPath('userData'), 'audio'));
const voicesService = createVoicesService(() => settingsService.get().cartesiaApiKey, logger);

const callable = createApp({
  services: { settings: settingsService, tts: ttsService, history: historyService, voices: voicesService },
  logger,
});

const createWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // F12 で DevTools をトグル
  optimizer.watchWindowShortcuts(mainWindow);

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
};

const onReady = async (): Promise<void> => {
  await app.whenReady();
  logger.info('[main] app ready');

  ipcMain.handle('hono-rpc-electron', async (_, url: string, method?: string, headers?: [key: string, value: string][], body?: string) => {
    logger.debug(`[ipc] --> ${method ?? 'GET'} ${url}`, body ? { bodyLength: body.length } : {});

    try {
      const res = await callable.request(url, { method, headers, body });
      const data = await res.json();

      if (res.status >= 400) {
        logger.error(`[ipc] <-- ${method ?? 'GET'} ${url} ${res.status}`, { data });
      } else {
        logger.debug(`[ipc] <-- ${method ?? 'GET'} ${url} ${res.status}`);
      }

      return { ...res, data };
    } catch (err) {
      logger.error(`[ipc] request error ${method ?? 'GET'} ${url}`, err instanceof Error ? err.message : err, err instanceof Error ? err.stack : undefined);
      throw err;
    }
  });

  ipcMain.handle('save-wav-dialog', async (_, wavBase64: string) => {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'WAV Audio', extensions: ['wav'] }],
      defaultPath: 'output.wav',
    });

    if (result.canceled || !result.filePath) {
      return { saved: false };
    }

    const { writeFile } = await import('node:fs/promises');
    const buffer = Buffer.from(wavBase64, 'base64');
    await writeFile(result.filePath, buffer);
    logger.info('[main] WAV saved', { filePath: result.filePath, size: buffer.byteLength });
    return { saved: true, filePath: result.filePath };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
};

onReady();

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
