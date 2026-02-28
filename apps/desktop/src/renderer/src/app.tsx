import { useState, type FC } from 'react';
import { Button } from 'react-aria-components';
import { TtsPage } from './plugins/tts/page';
import { SettingsPage } from './plugins/settings/page';
import { GuidePage } from './plugins/guide/page';

type Page = 'generate' | 'settings' | 'guide';

export const App: FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('generate');

  return (
    <div className="flex h-screen bg-neutral-50 text-neutral-700">
      <nav className="w-44 bg-white border-r border-neutral-200 flex flex-col pt-8 px-3 gap-0.5" aria-label="Main navigation">
        <p className="text-[11px] font-medium tracking-widest text-sky-500 px-3 mb-3">Yomikoe</p>
        <Button
          onPress={() => setCurrentPage('generate')}
          aria-current={currentPage === 'generate' ? 'page' : undefined}
          className={`text-left px-3 py-1.5 rounded text-[13px] cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-sky-300 transition-colors ${
            currentPage === 'generate' ? 'bg-sky-50 text-sky-700' : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'
          }`}
        >
          音声生成
        </Button>
        <Button
          onPress={() => setCurrentPage('settings')}
          aria-current={currentPage === 'settings' ? 'page' : undefined}
          className={`text-left px-3 py-1.5 rounded text-[13px] cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-sky-300 transition-colors ${
            currentPage === 'settings' ? 'bg-sky-50 text-sky-700' : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'
          }`}
        >
          設定
        </Button>
        <div className="flex-1" />
        <Button
          onPress={() => setCurrentPage('guide')}
          aria-current={currentPage === 'guide' ? 'page' : undefined}
          className={`text-left px-3 py-1.5 rounded text-[13px] cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-sky-300 transition-colors mb-4 ${
            currentPage === 'guide' ? 'bg-sky-50 text-sky-700' : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'
          }`}
        >
          使い方
        </Button>
      </nav>

      <main className="flex-1 overflow-auto px-10 py-8">
        {currentPage === 'generate' && <TtsPage />}
        {currentPage === 'settings' && <SettingsPage />}
        {currentPage === 'guide' && <GuidePage />}
      </main>
    </div>
  );
};
