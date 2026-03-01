# Cartesia Download

Cartesia TTS API を使った音声合成ツール群。デスクトップアプリ・CLI・Discord ボイスボットの 3 つのアプリケーションを含む pnpm モノレポ。

## 構成

```
packages/
  core/             @cartesia-download/core — TTS・アノテーション共通ライブラリ
apps/
  desktop/          Yomikoe（読み声） — デスクトップアプリ
  cli/              cartesia-download — CLI ツール
  discord-bot/      cartesia-discord-bot — Discord ボイスボット
```

### @cartesia-download/core

Cartesia TTS API クライアント、ストリーミングパイプライン、Claude による感情アノテーション、WAV ヘッダー生成などの共通ロジック。

### Yomikoe（デスクトップアプリ）

テキストから音声を生成する Electron デスクトップアプリ。GUI で声モデルの管理、音声生成、再生・保存ができます。
感情アノテーション機能を使うと、AI が感情タグを自動付与し、自然で表現力豊かな音声を生成できます。

詳しい使い方は [apps/desktop/README.md](apps/desktop/README.md) を参照してください。

### cartesia-download（CLI）

テキストから音声を生成する CLI ツール。標準出力への PCM ストリーミングと WAV ファイル出力に対応。

```bash
# WAV ファイルに保存
cartesia-download --text "こんにちは" --voice-id <VOICE_ID> --output hello.wav

# PCM を直接オーディオプレイヤーへ
cartesia-download --text "テスト" --voice-id <VOICE_ID> | aplay -f S16_LE -r 44100 -c 1
```

### cartesia-discord-bot

Discord のボイスチャンネルに参加してテキストを読み上げるボット。Claude による感情アノテーション付き TTS、SQLite によるキャッシュと設定管理。

**スラッシュコマンド:**

| コマンド               | 説明                                              |
| ---------------------- | ------------------------------------------------- |
| `/join`                | ユーザーのボイスチャンネルに参加                  |
| `/leave`               | ボイスチャンネルから退出                          |
| `/say text:"..."`      | テキストを読み上げ（アノテーション + キャッシュ） |
| `/voice voiceId:"..."` | サーバーの音声設定を変更                          |

## セットアップ

### 前提条件

- Node.js 18+
- pnpm 10+
- FFmpeg（Discord ボット用）

### インストール

```bash
pnpm install
```

### 環境変数

**CLI:**

| 変数                | 説明                                       |
| ------------------- | ------------------------------------------ |
| `CARTESIA_API_KEY`  | Cartesia TTS API キー（必須）              |
| `CARTESIA_VOICE_ID` | デフォルトの voice ID                      |
| `ANTHROPIC_API_KEY` | Anthropic API キー（感情アノテーション用） |

**Discord ボット:**

| 変数                  | 説明                           | デフォルト           |
| --------------------- | ------------------------------ | -------------------- |
| `DISCORD_TOKEN`       | Discord ボットトークン（必須） | —                    |
| `CARTESIA_API_KEY`    | Cartesia TTS API キー（必須）  | —                    |
| `DEFAULT_VOICE_ID`    | デフォルトの音声 ID（必須）    | —                    |
| `ANTHROPIC_API_KEY`   | Anthropic API キー             | —                    |
| `DEFAULT_MODEL`       | TTS モデル                     | `sonic-2`            |
| `DEFAULT_SAMPLE_RATE` | サンプルレート                 | `44100`              |
| `DEFAULT_LANGUAGE`    | 言語                           | `ja`                 |
| `DB_PATH`             | SQLite データベースパス        | `./data/bot.db`      |
| `CACHE_DIR`           | 音声キャッシュディレクトリ     | `./data/cache`       |
| `CACHE_MAX_BYTES`     | キャッシュ最大サイズ（バイト） | `524288000`（500MB） |
| `CACHE_MAX_ENTRIES`   | キャッシュ最大エントリ数       | `10000`              |

### RC ファイル（CLI 用）

`.cartesiarc.json` で CLI のデフォルト値を設定できる。

```json
{
  "apiKey": "...",
  "voiceId": "...",
  "model": "sonic-2",
  "language": "ja"
}
```

設定の優先順位: **CLI 引数 > 環境変数 > .cartesiarc.json**

## CLI オプション

| オプション      | 短縮 | 型      | デフォルト | 説明                         |
| --------------- | ---- | ------- | ---------- | ---------------------------- |
| `--text`        | `-t` | string  | —          | 合成するテキスト             |
| `--input`       | `-i` | string  | —          | テキストファイルのパス       |
| `--voice-id`    |      | string  | —          | Cartesia の voice ID         |
| `--output`      | `-o` | string  | —          | 出力 WAV ファイルパス        |
| `--model`       | `-m` | string  | `sonic-3`  | モデル ID                    |
| `--sample-rate` |      | number  | `44100`    | サンプルレート（Hz）         |
| `--provider`    |      | string  | `claude`   | アノテーションプロバイダー   |
| `--no-annotate` |      | boolean | `false`    | 感情アノテーションをスキップ |

## 開発

```bash
# 全パッケージのテスト
pnpm test

# 全パッケージの型チェック
pnpm typecheck

# 全パッケージのビルド
pnpm build

# リント・フォーマット
pnpm lint
pnpm fmt
```

## 技術スタック

- **TypeScript** + [tsgo](https://github.com/nicolo-ribaudo/tc39-proposal-type-annotations)（型チェック）
- [tsdown](https://github.com/nicolo-ribaudo/tsdown) — ビルド
- [vitest](https://vitest.dev/) — テスト
- [oxlint](https://oxc.rs/) / [oxfmt](https://oxc.rs/) — リント・フォーマット
- [neverthrow](https://github.com/supermacro/neverthrow) — Result 型エラーハンドリング
- [gunshi](https://github.com/kazupon/gunshi) — CLI フレームワーク
- [@cartesia/cartesia-js](https://github.com/cartesia-ai/cartesia-js) — Cartesia TTS SDK
- [Vercel AI SDK](https://sdk.vercel.ai/) + [@ai-sdk/anthropic](https://github.com/vercel/ai) — Claude 感情アノテーション
- [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/) — デスクトップアプリ
- [React](https://react.dev/) + [Jotai](https://jotai.org/) — UI + 状態管理
- [Hono](https://hono.dev/) — 型安全 IPC（Electron メイン↔レンダラー）
- [Tailwind CSS](https://tailwindcss.com/) v4 — スタイリング
- [discord.js](https://discord.js.org/) + [@discordjs/voice](https://github.com/discordjs/voice) — Discord 連携
- [Drizzle ORM](https://orm.drizzle.team/) + [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — DB

## アーキテクチャ

### 音声生成パイプライン（`/say` コマンド）

```
テキスト入力
  → アノテーションキャッシュ確認（SHA-256）
  → ミス: Claude で感情アノテーション → キャッシュ保存
  → 音声キャッシュ確認（テキスト+voiceId+model+sampleRate のハッシュ）
  → ミス: Cartesia TTS (PCM S16LE) → ファイル保存 + DB 登録
  → AudioPlayer → VoiceConnection → Discord ボイスチャンネル
```

### キャッシュ戦略

- **アノテーションキャッシュ**: テキスト + プロバイダーをキーに SQLite に保存
- **音声キャッシュ**: コンテンツハッシュをキーにファイルパスを管理
- **LRU エビクション**: `lastAccessedAt` 基準、最大サイズ・最大エントリ数で制限

### データベース（SQLite）

| テーブル            | 用途                                                  |
| ------------------- | ----------------------------------------------------- |
| `guild_settings`    | サーバーごとの音声設定（voiceId, language, model 等） |
| `utterance_history` | 読み上げ履歴                                          |
| `audio_cache`       | 音声ファイルキャッシュのメタデータ                    |
| `annotation_cache`  | アノテーションキャッシュ                              |

## ライセンス

MIT
