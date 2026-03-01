import { Suspense, useState, type FC } from 'react';
import { TtsPage } from './plugins/tts/page';
import { SettingsPage } from './plugins/settings/page';
import { GuidePage } from './plugins/guide/page';
import { VoicesPage } from './plugins/voices/page';
import { SidebarNav } from './components/sidebar-nav';

type Page = 'generate' | 'settings' | 'guide' | 'voices';

export const App: FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('generate');

  return (
    <div className="flex h-screen bg-neutral-50 text-neutral-700">
      <SidebarNav currentPage={currentPage} onNavigate={setCurrentPage} />

      <main className="flex-1 overflow-auto px-10 py-8">
        {currentPage === 'generate' && <TtsPage />}
        {currentPage === 'settings' && <SettingsPage />}
        {currentPage === 'guide' && <GuidePage />}
        {currentPage === 'voices' && (
          <Suspense fallback={<p className="text-sm text-neutral-400">読み込み中...</p>}>
            <VoicesPage />
          </Suspense>
        )}
      </main>
    </div>
  );
};
