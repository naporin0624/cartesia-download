import { hc } from 'hono/client';
import type { CallableType } from '@shared/callable/types';

const serializeHeaders = (headers?: HeadersInit): [string, string][] => {
  if (!headers) return [];
  if (Array.isArray(headers)) return headers as [string, string][];
  if (headers instanceof Headers) return Array.from(headers.entries());
  return Object.entries(headers);
};

export const client = hc<CallableType>('http://internal.localhost', {
  async fetch(input, init) {
    const url = input.toString();
    const { data, ...rest } = await window.electron.ipcRenderer.invoke('hono-rpc-electron', url, init?.method, serializeHeaders(init?.headers), init?.body);
    return Response.json(data, rest);
  },
});
