# Audio History List Design

## Goal

Replace the native `<audio controls>` element with a custom audio history list. Each generation result is persisted to disk and displayed as a flat list row with play/stop icon, truncated text, and duration.

## Data Model

```typescript
interface HistoryEntry {
  id: string; // crypto.randomUUID()
  text: string; // input text
  filePath: string; // absolute path to WAV file
  durationSec: number; // audio duration in seconds
  presetName: string; // preset used for generation
  createdAt: string; // ISO 8601
}
```

## Storage

- WAV files: `app.getPath('userData')/audio/{id}.wav`
- Metadata: `app.getPath('userData')/audio/history.json` (array of HistoryEntry)

## Hono Routes

### New: History Routes

- `GET /history` — return all history entries (sorted by createdAt desc)
- `DELETE /history/:id` — delete entry + WAV file from disk

### Modified: TTS Generate

`POST /tts/generate` response changes:

- After generating WAV, save file to disk and append to history.json
- Return `{ historyEntry: HistoryEntry }` instead of `{ wav: base64, annotatedText }`
- Renderer no longer receives raw WAV data; it fetches audio via file path

### New: Audio File Access

- `GET /history/:id/audio` — return WAV file as base64 for playback in renderer

## Renderer UI

### Component: HistoryList

- Uses react-aria-components `Virtualizer` + `ListBox`
- Fixed row height (48px) for virtualizer compatibility
- Each row layout: `[play/stop button] [text truncated] [MM:SS]`

### Playback

- Single `Audio` instance managed in Jotai atom
- Only one track plays at a time (clicking another stops current)
- Playing row gets visual highlight (e.g. accent color on left border)

### State (Jotai atoms)

```
historyAtom: HistoryEntry[]           // fetched from GET /history
playingIdAtom: string | null          // currently playing entry id
audioInstanceAtom: Audio | null       // single Audio instance
fetchHistoryAtom: write atom          // GET /history
deleteHistoryAtom: write atom         // DELETE /history/:id
togglePlayAtom: write atom            // play/stop toggle
```

### Flow

1. On generate: POST /tts/generate → server saves WAV + updates history → renderer refetches history list
2. On play: GET /history/:id/audio → create Blob URL → Audio.play()
3. On stop: Audio.pause() + reset
4. On delete: DELETE /history/:id → refetch history

## UI Layout (TtsPage)

```
┌─────────────────────────────────┐
│ Preset Select                   │
│ ┌─────────────────────────────┐ │
│ │ Text Input                  │ │
│ └─────────────────────────────┘ │
│ [Generate Button]               │
│                                 │
│ ── History ──────────────────── │
│ ▶ こんにちは、今日は...   0:03  │
│ ■ おはようございます...   0:02  │ ← playing (highlighted)
│ ▶ テスト音声です...      0:01  │
│ ▶ ...                          │
│ (virtualized list)              │
└─────────────────────────────────┘
```

## Main Process Service

### HistoryService

```typescript
interface HistoryService {
  list(): HistoryEntry[];
  add(entry: Omit<HistoryEntry, 'id' | 'createdAt'>, wav: ArrayBuffer): HistoryEntry;
  remove(id: string): void;
  getAudio(id: string): ArrayBuffer;
}
```

- Reads/writes `history.json` for metadata
- Manages WAV files in `audio/` directory
- Calculates duration from WAV header (dataByteLength / sampleRate / channels / bytesPerSample)
