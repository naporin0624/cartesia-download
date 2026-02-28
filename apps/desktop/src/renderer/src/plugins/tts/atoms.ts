import { atom } from 'jotai';
import { client } from '@renderer/adapters/client';
import { settingsAtom } from '@renderer/plugins/settings/atoms';
import { fetchHistoryAtom } from '@renderer/plugins/history/atoms';

export const inputTextAtom = atom('');
export const isGeneratingAtom = atom(false);
export const errorAtom = atom<string | null>(null);
export const selectedPresetIdAtom = atom<string | null>(null);

export const generateAtom = atom(null, async (get, set) => {
  const text = get(inputTextAtom);
  const settings = get(settingsAtom);
  const presetId = get(selectedPresetIdAtom);

  if (!text.trim() || !presetId) return;

  const preset = settings.presets.find((p) => p.id === presetId);
  if (!preset) return;

  set(isGeneratingAtom, true);
  set(errorAtom, null);

  try {
    const res = await client.tts.generate.$post({
      json: {
        text,
        options: {
          voiceId: preset.voiceId,
          model: settings.model,
          sampleRate: settings.sampleRate,
          language: settings.language,
          annotate: settings.annotate,
          systemPrompt: preset.systemPrompt || undefined,
          presetName: preset.name,
        },
      },
    });

    const data = await res.json();

    if ('error' in data) {
      set(errorAtom, `Generation failed: ${data.error}`);
      return;
    }

    // Refresh history list
    await set(fetchHistoryAtom);
  } catch (err) {
    set(errorAtom, err instanceof Error ? err.message : 'Unknown error');
  } finally {
    set(isGeneratingAtom, false);
  }
});
