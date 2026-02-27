# Cartesia クローン声をaudioファイルとして保存する方法

基本的な流れは2ステップです。`/voices/clone` でvoice IDを取得し、そのIDを使って `/tts/bytes` エンドポイントを叩くだけです。Python SDKなら `tts.generate()` → `write_to_file()` の1行で完結します。

---

## エンドポイントの選び方

| エンドポイント | メソッド | パス             | 出力形式          | 用途                   |
| -------------- | -------- | ---------------- | ----------------- | ---------------------- |
| **Bytes**      | `POST`   | `/tts/bytes`     | WAV, MP3, raw PCM | **ファイル保存に最適** |
| **SSE**        | `POST`   | `/tts/sse`       | raw PCMのみ       | HTTPストリーミング     |
| **WebSocket**  | `WSS`    | `/tts/websocket` | raw PCMのみ       | リアルタイム・最低遅延 |

ファイル保存目的なら **Bytesエンドポイント一択**です。WAV/MP3コンテナのヘッダーも自動で付与されるため、レスポンスをそのままファイルに書き込むだけで再生可能なファイルが得られます。

---

## ステップ1：声をクローンしてvoice IDを取得

声のサンプル（5〜10秒で十分）をアップロードすると `id` が返ってきます。

```python
from cartesia import Cartesia

client = Cartesia(api_key="YOUR_API_KEY")

cloned_voice = client.voices.clone(
    clip=open("my_voice_sample.wav", "rb"),
    name="My Cloned Voice",
    language="ja",
    mode="similarity",  # または "stability"（ノイズが少ない）
    enhance=False,
)
voice_id = cloned_voice.id
print(f"Voice ID: {voice_id}")
```

---

## ステップ2：TTSを生成してファイル保存

### 一番シンプルな方法 — `write_to_file()`

```python
response = client.tts.generate(
    model_id="sonic-3",
    transcript="こんにちは、これはクローンされた声です。",
    voice={"mode": "id", "id": voice_id},
    output_format={
        "container": "wav",
        "encoding": "pcm_s16le",
        "sample_rate": 44100,
    },
)
response.write_to_file("output.wav")
```

### MP3で保存したい場合

```python
with open("output.mp3", "wb") as f:
    for chunk in client.tts.bytes(
        model_id="sonic-3",
        transcript="MP3形式で保存します。",
        voice={"mode": "id", "id": voice_id},
        output_format={
            "container": "mp3",
            "sample_rate": 44100,
            "bit_rate": 128000,
        },
    ):
        f.write(chunk)
```

### 非同期版（AsyncCartesia）

```python
import asyncio
from cartesia import AsyncCartesia

client = AsyncCartesia(api_key="YOUR_API_KEY")

async def main():
    response = await client.tts.generate(
        model_id="sonic-3",
        transcript="非同期で生成して保存。",
        voice={"mode": "id", "id": voice_id},
        output_format={"container": "wav", "encoding": "pcm_f32le", "sample_rate": 44100},
    )
    await response.write_to_file("async_output.wav")

asyncio.run(main())
```

---

## TypeScript / JavaScript の場合

```bash
npm install @cartesia/cartesia-js
```

```typescript
import { CartesiaClient } from '@cartesia/cartesia-js';
import fs from 'node:fs';

const client = new CartesiaClient({ apiKey: process.env.CARTESIA_API_KEY });

const response = await client.tts.bytes({
  modelId: 'sonic-3',
  voice: { mode: 'id', id: 'your-cloned-voice-id' },
  outputFormat: { container: 'wav', encoding: 'pcm_s16le', sampleRate: 44100 },
  transcript: 'クローンされた声でこんにちは！',
});

fs.writeFileSync('output.wav', Buffer.from(await response.bytes()));
```

---

## cURL だけで試す場合

```bash
curl -X POST "https://api.cartesia.ai/tts/bytes" \
  -H "Cartesia-Version: 2025-04-16" \
  -H "X-API-Key: $CARTESIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "こんにちは",
    "model_id": "sonic-3",
    "voice": {"mode": "id", "id": "your-voice-id"},
    "output_format": {"container": "wav", "encoding": "pcm_s16le", "sample_rate": 44100}
  }' > output.wav
```

---

## output_format の設定まとめ

| コンテナ | エンコーディング      | サンプルレート | 備考                     |
| -------- | --------------------- | -------------- | ------------------------ |
| `wav`    | `pcm_s16le`           | `44100`        | **汎用的でおすすめ**     |
| `wav`    | `pcm_f32le`           | `44100`        | 高品質・ファイルサイズ大 |
| `mp3`    | —（`bit_rate`を使う） | `44100`        | 容量を抑えたい場合       |
| `raw`    | `pcm_s16le`           | `22050`        | WebSocket/SSE向け        |

---

## クローンモードの使い分け

- **similarity モード**：元の声に最も近い。背景ノイズもそのまま再現される可能性あり
- **stability モード**：クリーンな出力。スタジオ品質だが若干似せ度が落ちる
- **enhance**：背景ノイズが多いサンプルのみ `true` にする。通常は `false` の方が類似度が高い
- サンプルは10秒以上あっても品質は変わらない（5〜10秒で十分）
