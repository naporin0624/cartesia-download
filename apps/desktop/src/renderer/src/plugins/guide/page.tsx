import type { FC } from 'react';

const sectionTitleClass = 'text-[11px] font-medium tracking-widest text-neutral-400 uppercase';
const headingClass = 'text-sm font-medium text-neutral-800';
const bodyClass = 'text-sm text-neutral-600 leading-relaxed';
const linkClass = 'text-sky-600 underline hover:text-sky-500';
const stepNumberClass = 'flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[11px] font-medium text-sky-700';
const cardClass = 'bg-white border border-neutral-200 rounded px-4 py-3';
const codeClass = 'bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded text-xs font-mono text-neutral-600';
const tipClass = 'bg-sky-50 border border-sky-200 rounded px-4 py-3 text-sm text-sky-800';

export const GuidePage: FC = () => (
  <div className="max-w-2xl space-y-10">
    <div>
      <h1 className="text-lg font-medium text-neutral-900">使い方</h1>
      <p className="text-sm text-neutral-500 mt-1">Yomikoe はテキストから自然な音声を生成するアプリです。 AI による感情アノテーション機能を使うと、より表現力豊かな音声になります。</p>
    </div>

    {/* はじめに必要なもの */}
    <section className="space-y-3">
      <p className={sectionTitleClass}>はじめに必要なもの</p>
      <div className={`${cardClass} space-y-2`}>
        <div className="flex items-start gap-3">
          <span className="text-sky-500 mt-0.5">*</span>
          <div>
            <p className={headingClass}>Cartesia API Key（必須）</p>
            <p className="text-xs text-neutral-500">音声を生成するために必要です</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-neutral-300 mt-0.5">*</span>
          <div>
            <p className={headingClass}>Anthropic API Key（任意）</p>
            <p className="text-xs text-neutral-500">感情アノテーション機能を使う場合に必要です</p>
          </div>
        </div>
      </div>
    </section>

    {/* セットアップ手順 */}
    <section className="space-y-4">
      <p className={sectionTitleClass}>セットアップ</p>

      {/* Step 1 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={stepNumberClass}>1</span>
          <p className={headingClass}>Cartesia API Key を取得する</p>
        </div>
        <div className="ml-7 space-y-1.5">
          <p className={bodyClass}>
            <a href="https://play.cartesia.ai/keys" target="_blank" rel="noopener noreferrer" className={linkClass}>
              play.cartesia.ai/keys
            </a>{' '}
            にアクセスし、アカウントを作成してログインします。
          </p>
          <p className={bodyClass}>
            「Create API Key」をクリックし、表示されたキー（<span className={codeClass}>sk-...</span> の形式）をコピーします。
          </p>
        </div>
      </div>

      {/* Step 2 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={stepNumberClass}>2</span>
          <p className={headingClass}>設定画面で API Key を入力する</p>
        </div>
        <div className="ml-7">
          <p className={bodyClass}>左メニューの「設定」を開き、「API キー」セクションにコピーしたキーを貼り付けます。</p>
        </div>
      </div>

      {/* Step 3 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={stepNumberClass}>3</span>
          <p className={headingClass}>ボイスモデルを追加する</p>
        </div>
        <div className="ml-7 space-y-2">
          <p className={bodyClass}>「設定」画面の「ボイスモデル」セクションで「モデルを追加」を押します。</p>
          <div className={`${cardClass} space-y-2.5`}>
            <div>
              <p className="text-xs font-medium text-neutral-700">モデル名</p>
              <p className="text-xs text-neutral-500">自由に名前を付けてください（例: ナレーター、キャラA）</p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-700">Voice ID の取得方法</p>
              <ol className="text-xs text-neutral-500 list-decimal list-inside space-y-0.5 mt-0.5">
                <li>
                  <a href="https://play.cartesia.ai/voices" target="_blank" rel="noopener noreferrer" className={linkClass}>
                    play.cartesia.ai/voices
                  </a>{' '}
                  で声を検索する
                </li>
                <li>
                  使いたい声の右上にある <strong>⋯</strong> をクリック
                </li>
                <li>
                  「<strong>Copy ID</strong>」を選択してコピー
                </li>
                <li>アプリの Voice ID 欄に貼り付ける</li>
              </ol>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-700">アノテーション指示（任意）</p>
              <p className="text-xs text-neutral-500">AI にどんな感情で読んでほしいかを伝える指示文です。 空欄ならデフォルトの指示が使われます。</p>
            </div>
          </div>
        </div>
      </div>

      {/* Step 4 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={stepNumberClass}>4</span>
          <p className={headingClass}>設定を保存する</p>
        </div>
        <div className="ml-7">
          <p className={bodyClass}>ページ下部の「保存」ボタンを押して完了です。設定はアプリを閉じても保持されます。</p>
        </div>
      </div>
    </section>

    {/* 音声を生成する */}
    <section className="space-y-4">
      <p className={sectionTitleClass}>音声を生成する</p>
      <p className={bodyClass}>左メニューの「音声生成」を開きます。</p>

      <div className="space-y-2.5">
        <div className="flex items-start gap-2">
          <span className={stepNumberClass}>1</span>
          <p className={bodyClass}>ドロップダウンからボイスモデルを選ぶ</p>
        </div>
        <div className="flex items-start gap-2">
          <span className={stepNumberClass}>2</span>
          <p className={bodyClass}>テキストエリアに読み上げたいテキストを入力する</p>
        </div>
        <div className="flex items-start gap-2">
          <span className={stepNumberClass}>3</span>
          <p className={bodyClass}>「生成」ボタンを押す（テキストの長さによって数秒〜数十秒かかります）</p>
        </div>
        <div className="flex items-start gap-2">
          <span className={stepNumberClass}>4</span>
          <p className={bodyClass}>生成された音声は履歴に表示され、再生や WAV 保存ができます</p>
        </div>
      </div>

      <div className={tipClass}>ボイスモデルが未登録の場合は「設定画面でモデルを追加してください」と表示されます。先に設定画面でモデルを追加してください。</div>
    </section>

    {/* 感情アノテーション */}
    <section className="space-y-4">
      <p className={sectionTitleClass}>感情アノテーション</p>
      <p className={bodyClass}>
        感情アノテーションを有効にすると、入力テキストを AI（Claude）が分析し、 嬉しい・悲しい・驚きなどの感情タグを自動で付けてから音声を生成します。
        棒読みではない、自然で表現力豊かな音声になります。
      </p>

      <div className={cardClass}>
        <p className="text-xs font-medium text-neutral-700 mb-2">仕組み</p>
        <div className="flex flex-col gap-1 text-xs text-neutral-500 font-mono">
          <p>入力テキスト</p>
          <p className="text-neutral-400">{'  ↓ Claude が感情を分析'}</p>
          <p>感情タグ付きテキストに変換</p>
          <p className="text-neutral-300">{'  例: <happy, speed:1.0>やったー！</happy>'}</p>
          <p className="text-neutral-400">{'  ↓ Cartesia TTS に送信'}</p>
          <p>表現力豊かな音声が生成される</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className={headingClass}>有効にする方法</p>
        <ol className={`${bodyClass} list-decimal list-inside space-y-1`}>
          <li>「設定」画面の「感情アノテーション」チェックボックスをオンにする</li>
          <li>
            表示される「Anthropic API Key」欄にキーを入力する （
            <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className={linkClass}>
              console.anthropic.com
            </a>{' '}
            から取得）
          </li>
          <li>「保存」を押す</li>
        </ol>
      </div>

      <div className={tipClass}>ボイスモデルごとに「アノテーション指示」をカスタマイズすると、 同じテキストでもキャラクターに合った読み方にできます。</div>
    </section>

    {/* 音声出力設定 */}
    <section className="space-y-3">
      <p className={sectionTitleClass}>音声出力の設定</p>
      <p className={bodyClass}>「設定」画面の「音声出力」セクションで以下を変更できます。</p>
      <div className={cardClass}>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-neutral-500 border-b border-neutral-100">
              <th className="pb-2 font-medium">設定</th>
              <th className="pb-2 font-medium">選択肢</th>
              <th className="pb-2 font-medium">説明</th>
            </tr>
          </thead>
          <tbody className="text-neutral-600">
            <tr className="border-b border-neutral-50">
              <td className="py-2">音声エンジン</td>
              <td className="py-2">sonic-2 / sonic-3</td>
              <td className="py-2">sonic-2 は安定、sonic-3 は最新</td>
            </tr>
            <tr className="border-b border-neutral-50">
              <td className="py-2">言語</td>
              <td className="py-2">日本語 / English</td>
              <td className="py-2">生成する音声の言語</td>
            </tr>
            <tr>
              <td className="py-2">サンプルレート</td>
              <td className="py-2">22050 / 44100 Hz</td>
              <td className="py-2">高いほど高音質（ファイルサイズも大きくなります）</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
);
