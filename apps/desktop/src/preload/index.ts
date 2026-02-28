import { electronAPI } from '@electron-toolkit/preload';
import { contextBridge } from 'electron';

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI);
} else {
  // @ts-expect-error -- fallback for non-isolated context
  window.electron = electronAPI;
}
