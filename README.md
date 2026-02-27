# cartesia-download

Cartesia TTS API を使ってテキストから音声ファイル（WAV/MP3）を生成・ダウンロードする CLI ツール。

## インストール

```bash
pnpm install
pnpm build
```

## 使い方

### テキストから直接生成

```bash
CARTESIA_API_KEY=your_key cartesia-download \
  --text "こんにちは" \
  --voice-id your_voice_id \
  --output hello.wav
```

### テキストファイルから生成

```bash
CARTESIA_API_KEY=your_key cartesia-download \
  --input script.txt \
  --voice-id your_voice_id \
  --format mp3 \
  --output output.mp3
```

### 開発時の実行

```bash
CARTESIA_API_KEY=your_key pnpm dev -- \
  --text "テスト" \
  --voice-id your_voice_id \
  --output test.wav
```

## オプション

| オプション      | 短縮 | 型     | デフォルト | 説明                           |
| --------------- | ---- | ------ | ---------- | ------------------------------ |
| `--text`        | `-t` | string | -          | 合成するテキスト               |
| `--input`       | `-i` | string | -          | テキストファイルのパス         |
| `--voice-id`    |      | string | -          | Cartesia の voice ID           |
| `--output`      | `-o` | string | -          | 出力ファイルパス               |
| `--format`      | `-f` | string | `wav`      | 出力形式（`wav` または `mp3`） |
| `--model`       | `-m` | string | `sonic-3`  | モデル ID                      |
| `--sample-rate` |      | number | `44100`    | サンプルレート（Hz）           |

## 設定

### 環境変数

| 変数名              | 説明                      |
| ------------------- | ------------------------- |
| `CARTESIA_API_KEY`  | Cartesia API キー（必須） |
| `CARTESIA_VOICE_ID` | デフォルトの voice ID     |

### 設定ファイル

プロジェクトルートに `.cartesiarc.json` を配置すると、デフォルト値として使用されます。

```json
{
  "apiKey": "your_api_key",
  "voiceId": "your_voice_id",
  "model": "sonic-3",
  "sampleRate": 44100,
  "format": "wav",
  "outputPath": "output.wav"
}
```

設定の優先順位: **CLI 引数 > 環境変数 > .cartesiarc.json**

## 開発

```bash
# テスト
pnpm test

# テスト（ウォッチモード）
pnpm test:watch

# 型チェック
pnpm typecheck

# リント
pnpm lint

# フォーマット
pnpm format

# ビルド
pnpm build
```

## 技術スタック

- [gunshi](https://github.com/kazupon/gunshi) - CLI フレームワーク
- [@cartesia/cartesia-js](https://github.com/cartesia-ai/cartesia-js) - Cartesia TTS SDK
- [tsdown](https://github.com/rolldown/tsdown) - バンドラー
- [vitest](https://vitest.dev/) - テストフレームワーク
- [oxlint](https://oxc.rs/) / [oxfmt](https://oxc.rs/) - リンター・フォーマッター
