import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Component, Suspense, useCallback, type FC, type ReactNode } from 'react';
import { Button } from 'react-aria-components';
import { selectVoiceAtom, selectedVoiceIdAtom, voicesAtom, voicesExpandedAtom } from '@renderer/plugins/voices/atoms';

type Page = 'generate' | 'settings' | 'guide' | 'voices';

const navBtnClass = (active: boolean): string =>
  `text-left px-3 py-1.5 rounded text-[13px] cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-sky-300 transition-colors ${
    active ? 'bg-sky-50 text-sky-700' : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'
  }`;

class VoiceListErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  render(): ReactNode {
    if (this.state.error) {
      return <p className="text-[11px] text-red-400 px-6 py-1">読み込みに失敗しました</p>;
    }
    return this.props.children;
  }
}

const VoiceItem: FC<{ id: string; name: string; isActive: boolean; onSelect: (id: string) => void }> = ({ id, name, isActive, onSelect }) => {
  const handlePress = useCallback(() => onSelect(id), [onSelect, id]);
  return (
    <Button
      onPress={handlePress}
      aria-current={isActive ? 'page' : undefined}
      className={`text-left pl-6 pr-3 py-1 rounded text-[12px] cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-sky-300 transition-colors truncate ${
        isActive ? 'bg-sky-50 text-sky-700' : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
      }`}
    >
      {name}
    </Button>
  );
};

const VoiceList: FC<{ currentPage: Page; onSelect: (id: string) => void }> = ({ currentPage, onSelect }) => {
  const voices = useAtomValue(voicesAtom);
  const selectedId = useAtomValue(selectedVoiceIdAtom);

  return (
    <>
      {voices.map((v) => (
        <VoiceItem key={v.id} id={v.id} name={v.name} isActive={currentPage === 'voices' && selectedId === v.id} onSelect={onSelect} />
      ))}
    </>
  );
};

export const SidebarNav: FC<{ currentPage: Page; onNavigate: (page: Page) => void }> = ({ currentPage, onNavigate }) => {
  const [expanded, setExpanded] = useAtom(voicesExpandedAtom);
  const selectVoice = useSetAtom(selectVoiceAtom);

  const handleGenerate = useCallback(() => onNavigate('generate'), [onNavigate]);
  const handleSettings = useCallback(() => onNavigate('settings'), [onNavigate]);
  const handleGuide = useCallback(() => onNavigate('guide'), [onNavigate]);

  const handleToggleVoices = useCallback(() => {
    setExpanded((prev) => !prev);
  }, [setExpanded]);

  const handleSelectVoice = useCallback(
    (id: string) => {
      selectVoice(id);
      onNavigate('voices');
    },
    [selectVoice, onNavigate],
  );

  return (
    <nav className="w-44 bg-white border-r border-neutral-200 flex flex-col pt-8 px-3 gap-0.5" aria-label="Main navigation">
      <p className="text-[11px] font-medium tracking-widest text-sky-500 px-3 mb-3">Yomikoe</p>
      <Button onPress={handleGenerate} aria-current={currentPage === 'generate' ? 'page' : undefined} className={navBtnClass(currentPage === 'generate')}>
        音声生成
      </Button>

      <Button onPress={handleToggleVoices} className={navBtnClass(currentPage === 'voices')}>
        {expanded ? '▼' : '▶'} モデル
      </Button>
      {expanded && (
        <div className="flex flex-col gap-0.5">
          <VoiceListErrorBoundary>
            <Suspense fallback={<p className="text-[11px] text-neutral-400 px-6 py-1">読み込み中...</p>}>
              <VoiceList currentPage={currentPage} onSelect={handleSelectVoice} />
            </Suspense>
          </VoiceListErrorBoundary>
        </div>
      )}

      <Button onPress={handleSettings} aria-current={currentPage === 'settings' ? 'page' : undefined} className={navBtnClass(currentPage === 'settings')}>
        設定
      </Button>
      <div className="flex-1" />
      <Button onPress={handleGuide} aria-current={currentPage === 'guide' ? 'page' : undefined} className={`${navBtnClass(currentPage === 'guide')} mb-4`}>
        使い方
      </Button>
    </nav>
  );
};
