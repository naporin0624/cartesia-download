import { useCallback, type FC } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Button, ListBox, ListBoxItem } from 'react-aria-components';
import { Virtualizer, ListLayout } from 'react-aria-components';
import { historyAtom, playingIdAtom, togglePlayAtom, deleteHistoryAtom, downloadHistoryAtom } from './atoms';

const listBoxStyle = { display: 'block', padding: 0 } as const;
const listBoxItemStyle = { height: '100%', minHeight: 0 } as const;

const formatDuration = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

interface HistoryEntryProps {
  id: string;
  text: string;
  durationSec: number;
  isPlaying: boolean;
  onTogglePlay: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
}

const HistoryEntry: FC<HistoryEntryProps> = ({ id, text, durationSec, isPlaying, onTogglePlay, onDownload, onDelete }) => {
  const handleTogglePlay = useCallback(() => onTogglePlay(id), [onTogglePlay, id]);
  const handleDownload = useCallback(() => onDownload(id), [onDownload, id]);
  const handleDelete = useCallback(() => onDelete(id), [onDelete, id]);

  return (
    <ListBoxItem
      key={id}
      id={id}
      textValue={text}
      className={`flex items-center gap-3 px-3 h-12 rounded-lg cursor-default ${isPlaying ? 'bg-sky-50 border-l-2 border-sky-400' : 'hover:bg-neutral-50'}`}
      style={listBoxItemStyle}
    >
      <Button
        onPress={handleTogglePlay}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex-shrink-0 cursor-pointer transition-colors"
        aria-label={isPlaying ? '停止' : '再生'}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="2" y="2" width="10" height="10" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M3 1.5v11l9-5.5z" />
          </svg>
        )}
      </Button>
      <span className="flex-1 text-[13px] text-neutral-700 truncate">{text}</span>
      <span className="text-[11px] text-neutral-400 tabular-nums flex-shrink-0">{formatDuration(durationSec)}</span>
      <Button onPress={handleDownload} className="w-6 h-6 flex items-center justify-center rounded text-neutral-300 hover:text-sky-500 flex-shrink-0 cursor-pointer transition-colors" aria-label="保存">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 1v7M3 6l3 3 3-3M2 11h8" />
        </svg>
      </Button>
      <Button onPress={handleDelete} className="w-6 h-6 flex items-center justify-center rounded text-neutral-300 hover:text-red-400 flex-shrink-0 cursor-pointer transition-colors" aria-label="削除">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 2l8 8M10 2l-8 8" />
        </svg>
      </Button>
    </ListBoxItem>
  );
};

export const HistoryList: FC = () => {
  const history = useAtomValue(historyAtom);
  const playingId = useAtomValue(playingIdAtom);
  const togglePlay = useSetAtom(togglePlayAtom);
  const downloadHistory = useSetAtom(downloadHistoryAtom);
  const deleteHistory = useSetAtom(deleteHistoryAtom);

  if (history.length === 0) {
    return <p className="text-[13px] text-neutral-400 py-4">履歴がありません</p>;
  }

  return (
    <Virtualizer layout={ListLayout}>
      <ListBox aria-label="生成履歴" items={history} selectionMode="none" style={listBoxStyle} className="outline-none">
        {(entry) => (
          <HistoryEntry key={entry.id} id={entry.id} text={entry.text} durationSec={entry.durationSec} isPlaying={playingId === entry.id} onTogglePlay={togglePlay} onDownload={downloadHistory} onDelete={deleteHistory} />
        )}
      </ListBox>
    </Virtualizer>
  );
};
