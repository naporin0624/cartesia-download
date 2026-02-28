# Audio History List Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace native `<audio controls>` with a virtualized history list showing play/stop icon, truncated text, and duration for each generated audio.

**Architecture:** New `history` plugin following existing settings/tts plugin pattern. HistoryService persists WAV files + JSON metadata to `app.getPath('userData')/audio/`. Renderer uses react-aria-components Virtualizer + ListBox with Jotai atoms. TTS generate route extended to auto-save history.

**Tech Stack:** Hono routes, Zod validation, Jotai atoms, react-aria-components (Virtualizer, ListLayout, ListBox), Node.js fs

---

### Task 1: History Service Interface

**Files:**
- Create: `src/shared/plugins/history/service.d.ts`

**Step 1: Write the service interface**

```typescript
export interface HistoryEntry {
  id: string;
  text: string;
  filePath: string;
  durationSec: number;
  presetName: string;
  createdAt: string;
}

export interface HistoryService {
  list(): HistoryEntry[];
  add(entry: Omit<HistoryEntry, 'id' | 'createdAt'>, wav: ArrayBuffer): HistoryEntry;
  remove(id: string): void;
  getAudio(id: string): ArrayBuffer;
}
```

**Step 2: Commit**

```bash
git add src/shared/plugins/history/service.d.ts
git commit -m "feat(history): add HistoryService interface"
```

---

### Task 2: History Service Implementation (TDD)

**Files:**
- Create: `src/main/plugins/history/service.test.ts`
- Create: `src/main/plugins/history/service.ts`

**Step 1: Write failing tests**

Test file: `src/main/plugins/history/service.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHistoryService } from './service';

describe('createHistoryService', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'history-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('list returns empty array when no history exists', () => {
    const service = createHistoryService(tempDir);
    expect(service.list()).toEqual([]);
  });

  it('add persists WAV file and returns HistoryEntry', () => {
    const service = createHistoryService(tempDir);
    const wav = new ArrayBuffer(100);
    const entry = service.add({
      text: 'hello',
      filePath: '',
      durationSec: 1.5,
      presetName: 'test-preset',
    }, wav);

    expect(entry.id).toBeTruthy();
    expect(entry.text).toBe('hello');
    expect(entry.durationSec).toBe(1.5);
    expect(entry.presetName).toBe('test-preset');
    expect(entry.createdAt).toBeTruthy();
    expect(readFileSync(entry.filePath).byteLength).toBe(100);
  });

  it('list returns entries sorted by createdAt desc', () => {
    const service = createHistoryService(tempDir);
    const wav = new ArrayBuffer(10);
    service.add({ text: 'first', filePath: '', durationSec: 1, presetName: 'p' }, wav);
    service.add({ text: 'second', filePath: '', durationSec: 2, presetName: 'p' }, wav);
    const entries = service.list();
    expect(entries).toHaveLength(2);
    expect(entries[0].text).toBe('second');
    expect(entries[1].text).toBe('first');
  });

  it('remove deletes entry and WAV file', () => {
    const service = createHistoryService(tempDir);
    const wav = new ArrayBuffer(10);
    const entry = service.add({ text: 'to-delete', filePath: '', durationSec: 1, presetName: 'p' }, wav);

    service.remove(entry.id);

    expect(service.list()).toHaveLength(0);
    expect(() => readFileSync(entry.filePath)).toThrow();
  });

  it('getAudio returns WAV data for existing entry', () => {
    const service = createHistoryService(tempDir);
    const wavData = new Uint8Array([1, 2, 3, 4, 5]);
    const entry = service.add({ text: 'audio', filePath: '', durationSec: 1, presetName: 'p' }, wavData.buffer);

    const result = service.getAudio(entry.id);
    expect(new Uint8Array(result)).toEqual(wavData);
  });

  it('getAudio throws for non-existent entry', () => {
    const service = createHistoryService(tempDir);
    expect(() => service.getAudio('non-existent')).toThrow();
  });

  it('persists across service instances', () => {
    const wav = new ArrayBuffer(10);
    const service1 = createHistoryService(tempDir);
    service1.add({ text: 'persisted', filePath: '', durationSec: 1, presetName: 'p' }, wav);

    const service2 = createHistoryService(tempDir);
    expect(service2.list()).toHaveLength(1);
    expect(service2.list()[0].text).toBe('persisted');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/desktop && npx vitest run src/main/plugins/history/service.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

File: `src/main/plugins/history/service.ts`

```typescript
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HistoryEntry, HistoryService } from '@shared/plugins/history/service';

const HISTORY_FILE = 'history.json';

const readHistory = (dir: string): HistoryEntry[] => {
  const filePath = join(dir, HISTORY_FILE);
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as HistoryEntry[];
};

const writeHistory = (dir: string, entries: HistoryEntry[]): void => {
  writeFileSync(join(dir, HISTORY_FILE), JSON.stringify(entries, null, 2));
};

export const createHistoryService = (audioDir: string): HistoryService => {
  if (!existsSync(audioDir)) {
    mkdirSync(audioDir, { recursive: true });
  }

  return {
    list: (): HistoryEntry[] => {
      const entries = readHistory(audioDir);
      return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    add: (partial, wav): HistoryEntry => {
      const id = crypto.randomUUID();
      const filePath = join(audioDir, `${id}.wav`);
      writeFileSync(filePath, Buffer.from(wav));

      const entry: HistoryEntry = {
        id,
        text: partial.text,
        filePath,
        durationSec: partial.durationSec,
        presetName: partial.presetName,
        createdAt: new Date().toISOString(),
      };

      const entries = readHistory(audioDir);
      entries.push(entry);
      writeHistory(audioDir, entries);

      return entry;
    },

    remove: (id): void => {
      const entries = readHistory(audioDir);
      const entry = entries.find((e) => e.id === id);
      if (entry && existsSync(entry.filePath)) {
        rmSync(entry.filePath);
      }
      writeHistory(audioDir, entries.filter((e) => e.id !== id));
    },

    getAudio: (id): ArrayBuffer => {
      const entries = readHistory(audioDir);
      const entry = entries.find((e) => e.id === id);
      if (!entry) throw new Error(`History entry not found: ${id}`);
      const buffer = readFileSync(entry.filePath);
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    },
  };
};
```

**Step 4: Run tests to verify they pass**

Run: `cd apps/desktop && npx vitest run src/main/plugins/history/service.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/main/plugins/history/
git commit -m "feat(history): add HistoryService with file persistence"
```

---

### Task 3: History Hono Routes

**Files:**
- Create: `src/shared/plugins/history/routes.ts`
- Modify: `src/shared/callable/index.ts` — add history to Services + route mounting

**Step 1: Write routes**

File: `src/shared/plugins/history/routes.ts`

```typescript
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
```

**Step 2: Register in callable**

Modify `src/shared/callable/index.ts`:
- Add `import type { HistoryService } from '@shared/plugins/history/service';`
- Add `import { historyRoutes } from '@shared/plugins/history/routes';`
- Add `history: HistoryService;` to `Services` interface
- Add `.route('/history', historyRoutes)` to the Hono app chain

**Step 3: Register service in main**

Modify `src/main/index.ts`:
- Add `import { createHistoryService } from './plugins/history/service';`
- Add `const historyService = createHistoryService(join(app.getPath('userData'), 'audio'));` after existing service creation
- Add `history: historyService` to `services` object in `createApp()`

**Step 4: Commit**

```bash
git add src/shared/plugins/history/ src/shared/callable/index.ts src/main/index.ts
git commit -m "feat(history): add Hono routes and wire up service"
```

---

### Task 4: Modify TTS Generate to Save History

**Files:**
- Modify: `src/shared/plugins/tts/routes.ts`

**Step 1: Update TTS route to save history after generation**

The route handler receives `presetName` in the request body (add to Zod schema) and saves history entry after successful generation.

Add `presetName: z.string()` to `GenerateBody.options`.

After successful WAV generation, instead of returning base64 WAV directly:

```typescript
// Calculate duration from WAV data
const durationSec = pcmByteLength / (sampleRate * channels * bytesPerSample);
// Note: these values come from the options, pcmByteLength from the wav minus header

// Save to history
const historyEntry = c.var.services.history.add({
  text,
  filePath: '',
  durationSec,
  presetName: options.presetName,
}, wavArrayBuffer);

return c.json({ historyEntry });
```

The TTS service needs to return enough info to calculate duration. The WAV is PCM 16-bit mono, so:
`durationSec = (wavByteLength - 44) / (sampleRate * 1 * 2)`

**Step 2: Update service.d.ts to add presetName to TtsOptions**

Add `presetName: string` to `TtsOptions` in `src/shared/plugins/tts/service.d.ts`.

**Step 3: Commit**

```bash
git add src/shared/plugins/tts/routes.ts src/shared/plugins/tts/service.d.ts
git commit -m "feat(tts): save history entry on generate"
```

---

### Task 5: History Atoms (Renderer State)

**Files:**
- Create: `src/renderer/src/plugins/history/atoms.ts`

**Step 1: Write atoms**

```typescript
import { atom } from 'jotai';
import { client } from '@renderer/adapters/client';
import type { HistoryEntry } from '@shared/plugins/history/service';

export const historyAtom = atom<HistoryEntry[]>([]);
export const playingIdAtom = atom<string | null>(null);

export const fetchHistoryAtom = atom(null, async (_get, set) => {
  const res = await client.history.$get();
  const data = await res.json();
  if ('error' in data) return;
  set(historyAtom, data as HistoryEntry[]);
});

export const deleteHistoryAtom = atom(null, async (get, set, id: string) => {
  await client.history[':id'].$delete({ param: { id } });
  const current = get(historyAtom);
  set(historyAtom, current.filter((e) => e.id !== id));

  if (get(playingIdAtom) === id) {
    set(playingIdAtom, null);
  }
});

let audioInstance: HTMLAudioElement | null = null;
let currentBlobUrl: string | null = null;

const cleanup = () => {
  if (audioInstance) {
    audioInstance.pause();
    audioInstance.src = '';
    audioInstance = null;
  }
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = null;
  }
};

export const togglePlayAtom = atom(null, async (get, set, id: string) => {
  const currentId = get(playingIdAtom);

  if (currentId === id) {
    cleanup();
    set(playingIdAtom, null);
    return;
  }

  cleanup();

  const res = await client.history[':id'].audio.$get({ param: { id } });
  const data = await res.json();
  if ('error' in data) return;

  const binaryStr = atob((data as { wav: string }).wav);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: 'audio/wav' });
  currentBlobUrl = URL.createObjectURL(blob);

  audioInstance = new Audio(currentBlobUrl);
  audioInstance.addEventListener('ended', () => {
    set(playingIdAtom, null);
    cleanup();
  });

  set(playingIdAtom, id);
  await audioInstance.play();
});
```

**Step 2: Commit**

```bash
git add src/renderer/src/plugins/history/atoms.ts
git commit -m "feat(history): add Jotai atoms for history state and playback"
```

---

### Task 6: History List UI Component

**Files:**
- Create: `src/renderer/src/plugins/history/history-list.tsx`
- Modify: `src/renderer/src/plugins/tts/page.tsx` — replace `<audio>` with HistoryList

**Step 1: Write HistoryList component**

```tsx
import type { FC } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Button, ListBox, ListBoxItem } from 'react-aria-components';
import { Virtualizer, ListLayout } from 'react-aria-components';
import { historyAtom, playingIdAtom, togglePlayAtom, deleteHistoryAtom } from './atoms';

const formatDuration = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const HistoryList: FC = () => {
  const history = useAtomValue(historyAtom);
  const playingId = useAtomValue(playingIdAtom);
  const togglePlay = useSetAtom(togglePlayAtom);
  const deleteHistory = useSetAtom(deleteHistoryAtom);

  if (history.length === 0) {
    return <p className="text-[13px] text-neutral-500 py-4">履歴がありません</p>;
  }

  return (
    <Virtualizer layout={ListLayout}>
      <ListBox aria-label="生成履歴" items={history} selectionMode="none" style={{ display: 'block', padding: 0 }} className="outline-none">
        {(entry) => {
          const isPlaying = playingId === entry.id;
          return (
            <ListBoxItem
              key={entry.id}
              id={entry.id}
              textValue={entry.text}
              className={`flex items-center gap-3 px-3 h-12 rounded-lg cursor-default ${isPlaying ? 'bg-white/10' : 'hover:bg-white/5'}`}
              style={{ height: '100%', minHeight: 0 }}
            >
              <Button
                onPress={() => togglePlay(entry.id)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 flex-shrink-0"
                aria-label={isPlaying ? '停止' : '再生'}
              >
                {isPlaying ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="2" width="10" height="10" rx="1" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5v11l9-5.5z" /></svg>
                )}
              </Button>
              <span className="flex-1 text-[13px] text-neutral-300 truncate">{entry.text}</span>
              <span className="text-[11px] text-neutral-500 tabular-nums flex-shrink-0">{formatDuration(entry.durationSec)}</span>
              <Button
                onPress={() => deleteHistory(entry.id)}
                className="w-6 h-6 flex items-center justify-center rounded text-neutral-600 hover:text-red-400 flex-shrink-0"
                aria-label="削除"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2l8 8M10 2l-8 8" /></svg>
              </Button>
            </ListBoxItem>
          );
        }}
      </ListBox>
    </Virtualizer>
  );
};
```

**Step 2: Update TtsPage**

Modify `src/renderer/src/plugins/tts/page.tsx`:
- Remove `<audio controls>` element and save button + annotated text display
- Remove imports for `audioUrlAtom`, `wavBase64Atom`, `annotatedTextAtom`, `saveWavAtom`
- Add `import { HistoryList } from '@renderer/plugins/history/history-list';`
- Add `import { fetchHistoryAtom } from '@renderer/plugins/history/atoms';`
- Call `fetchHistory()` in useEffect alongside fetchSettings
- After the generate button, add:
  ```tsx
  <div className="mt-6">
    <p className={labelClass}>生成履歴</p>
    <div className="mt-2 max-h-[400px] overflow-auto">
      <HistoryList />
    </div>
  </div>
  ```

**Step 3: Update generateAtom**

Modify `src/renderer/src/plugins/tts/atoms.ts`:
- Remove `audioUrlAtom`, `wavBase64Atom`, `annotatedTextAtom`, `saveWavAtom`
- Import `fetchHistoryAtom` and trigger it after successful generation
- The generate response now returns `{ historyEntry }` instead of `{ wav, annotatedText }`
- After successful POST, just call `set(fetchHistoryAtom)` to refresh the list

**Step 4: Commit**

```bash
git add src/renderer/src/plugins/history/ src/renderer/src/plugins/tts/
git commit -m "feat(history): add virtualized history list UI and integrate with TTS page"
```

---

### Task 7: Callable Types Export

**Files:**
- Modify: `src/shared/callable/types.d.ts` — ensure CallableType reflects the new routes

**Step 1: Verify types.d.ts**

The existing `types.d.ts` re-exports `CallableType` from `createApp` return type. Since we added `.route('/history', historyRoutes)` in Task 3, the type is automatically updated. Verify the file still works:

```typescript
import type { createApp } from '.';
export type CallableType = ReturnType<typeof createApp>;
```

No changes needed if this pattern is already in place.

**Step 2: Run typecheck**

Run: `cd apps/desktop && npx tsc --noEmit` (or `pnpm typecheck` from root)
Expected: No type errors

**Step 3: Commit if any fixes needed**

---

### Task 8: End-to-End Verification

**Step 1: Build and run**

```bash
cd apps/desktop && pnpm dev
```

**Step 2: Verify flow**

1. Open app → go to 音声生成 page
2. Select a preset, enter text, click 生成
3. Verify: history list appears with the entry (play icon, truncated text, duration)
4. Click play icon → audio plays, icon changes to stop
5. Click stop → audio stops
6. Generate another → list has 2 entries, newest first
7. Close and reopen app → history persists
8. Click delete (X) → entry removed

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(history): complete audio history list with persistence and playback"
```
