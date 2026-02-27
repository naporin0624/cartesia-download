# Emotion Annotation Design

## Goal

CLI に LLM ベースの感情アノテーション機能を追加し、入力テキストに Cartesia SSML タグ（`<emotion>`, `<speed>`, `<volume>`）を自動挿入する。

## Architecture: TextAnnotator Strategy Pattern

### Interface

```typescript
export type AnnotatorProvider = 'claude';

export interface TextAnnotator {
  annotate(text: string): Promise<string | CartesiaDownloadError>;
}
```

### File Structure

```
src/
  core/
    annotator.ts          # factory: createAnnotator(provider, apiKey) → TextAnnotator
  providers/
    claude-annotator.ts   # AI SDK + @ai-sdk/anthropic
  commands/
    download.ts           # --provider, --no-annotate flags
  types.ts                # TextAnnotator interface, AnnotatorProvider type
```

### Data Flow

```
input text
  → TextAnnotator.annotate()
  → SSML-tagged text
  → TtsClient.generate()
  → audio file
```

### CLI Flags

| Flag            | Type    | Default  | Description                 |
| --------------- | ------- | -------- | --------------------------- |
| `--provider`    | string  | `claude` | LLM provider for annotation |
| `--no-annotate` | boolean | `false`  | Skip emotion annotation     |

### RcConfig Additions

```typescript
provider?: string
noAnnotate?: boolean
```

### Error Type Addition

```typescript
| { type: 'AnnotationError'; cause: unknown }
```

### Dependencies

- `ai` (Vercel AI SDK core)
- `@ai-sdk/anthropic` (Claude provider)

### Provider Strategy

初回は Claude のみ実装。`createAnnotator(provider)` factory で provider を switch し、未対応 provider はエラーを返す。新規 provider 追加は `src/providers/` にファイル追加 + factory に1行追加のみ。

### Prompt Design

LLM に以下を指示:

1. テキストを文/セクション単位で分析
2. 各文の文脈から適切な感情・速度・音量を判断
3. Cartesia SSML タグを挿入
4. 元テキストの内容は一切変更しない
5. 出力は SSML タグ付きテキストのみ（説明不要）

対応 SSML タグ:

- `<emotion value="..."/>` - 感情 (neutral, angry, excited, content, sad, scared 等)
- `<speed ratio="..."/>` - 速度 (0.6-1.5)
- `<volume ratio="..."/>` - 音量 (0.5-2.0)

### Testing

- `TextAnnotator` interface を mock して download コマンドをテスト
- `claude-annotator.ts` は AI SDK の `generateText` を mock してユニットテスト
- プロンプトの出力品質は手動 E2E テストで確認

### DI Integration

`runDownload` の deps に `annotator?: TextAnnotator` を追加。テスト時は mock を注入、本番は `createAnnotator()` factory で生成。
