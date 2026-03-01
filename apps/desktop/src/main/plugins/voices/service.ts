import type { VoiceEntry, VoicesService } from '@shared/plugins/voices/service';
import type { Logger } from '@shared/callable/index';

const CARTESIA_API_BASE = 'https://api.cartesia.ai';
const CARTESIA_API_VERSION = '2025-04-16';

interface CartesiaVoice {
  id: string;
  name: string;
  description: string;
  is_public: boolean;
  language: string;
  created_at: string;
}

interface CartesiaListResponse {
  data: CartesiaVoice[];
  has_more: boolean;
}

const headers = (apiKey: string): Record<string, string> => ({
  'X-API-Key': apiKey,
  'Cartesia-Version': CARTESIA_API_VERSION,
  'Content-Type': 'application/json',
});

export const createVoicesService = (getApiKey: () => string, logger: Logger): VoicesService => ({
  list: async (): Promise<VoiceEntry[]> => {
    const apiKey = getApiKey();
    logger.debug('[voices:service] listing my voices');

    const res = await fetch(`${CARTESIA_API_BASE}/voices/?is_owner=true`, {
      method: 'GET',
      headers: headers(apiKey),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error('[voices:service] list failed', { status: res.status, body: text });
      throw new Error(`Voice list failed: ${res.status} ${text}`);
    }

    const { data: voices } = (await res.json()) as CartesiaListResponse;

    const entries: VoiceEntry[] = voices.map((v) => ({
      id: v.id,
      name: v.name,
      description: v.description,
      isPublic: v.is_public,
      language: v.language,
      createdAt: v.created_at ?? '',
    }));

    logger.info('[voices:service] listed voices', { count: entries.length });
    return entries;
  },

  update: async (id: string, input): Promise<void> => {
    const apiKey = getApiKey();
    logger.debug('[voices:service] updating voice', { id, input });

    const res = await fetch(`${CARTESIA_API_BASE}/voices/${id}`, {
      method: 'PATCH',
      headers: headers(apiKey),
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        is_public: input.isPublic,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error('[voices:service] update failed', { status: res.status, body: text });
      throw new Error(`Voice update failed: ${res.status} ${text}`);
    }

    logger.info('[voices:service] voice updated', { id });
  },
});
