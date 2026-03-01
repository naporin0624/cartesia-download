import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, type FC, type Key } from 'react';
import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue, TextArea, TextField } from 'react-aria-components';
import { fetchSettingsAtom, settingsAtom } from '@renderer/plugins/settings/atoms';
import { fetchHistoryAtom } from '@renderer/plugins/history/atoms';
import { HistoryList } from '@renderer/plugins/history/history-list';
import { errorAtom, generateAtom, inputTextAtom, isGeneratingAtom, selectedPresetIdAtom } from './atoms';

const labelClass = 'block text-[11px] font-medium tracking-wide text-neutral-500 mb-1.5';
const selectBtnClass =
  'w-full flex items-center justify-between bg-neutral-100 px-3 py-2 text-sm text-neutral-800 outline-none focus:bg-white focus:ring-1 focus:ring-sky-300 rounded border border-neutral-200 cursor-pointer transition-colors';
const popoverClass = 'w-[var(--trigger-width)] bg-white border border-neutral-200 rounded shadow-lg shadow-neutral-200/60 py-1 outline-none';
const itemClass = 'px-3 py-1.5 text-sm text-neutral-500 outline-none cursor-pointer data-[focused]:bg-sky-50 data-[focused]:text-sky-700 data-[selected]:text-sky-700 data-[selected]:font-medium';

export const TtsPage: FC = () => {
  const [inputText, setInputText] = useAtom(inputTextAtom);
  const [selectedPresetId, setSelectedPresetId] = useAtom(selectedPresetIdAtom);
  const settings = useAtomValue(settingsAtom);
  const isGenerating = useAtomValue(isGeneratingAtom);
  const error = useAtomValue(errorAtom);
  const generate = useSetAtom(generateAtom);
  const fetchSettings = useSetAtom(fetchSettingsAtom);
  const fetchHistory = useSetAtom(fetchHistoryAtom);

  useEffect(() => {
    fetchSettings();
    fetchHistory();
  }, [fetchSettings, fetchHistory]);

  const handleGenerate = useCallback(() => {
    generate();
  }, [generate]);

  const handlePresetChange = useCallback((key: Key) => setSelectedPresetId(key as string), [setSelectedPresetId]);

  const hasModels = settings.presets.length > 0;
  const canGenerate = hasModels && !!selectedPresetId && !!inputText.trim() && !isGenerating;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-medium text-neutral-900">音声生成</h1>

      <Select selectedKey={selectedPresetId} onSelectionChange={handlePresetChange} isDisabled={!hasModels}>
        <Label className={labelClass}>ボイスモデル</Label>
        <Button className={selectBtnClass}>
          <SelectValue>{hasModels ? undefined : '設定画面でモデルを追加してください'}</SelectValue>
          <span className="text-neutral-400 text-xs" aria-hidden="true">
            &#9662;
          </span>
        </Button>
        <Popover className={popoverClass}>
          <ListBox>
            {settings.presets.map((preset) => (
              <ListBoxItem key={preset.id} id={preset.id} className={itemClass}>
                {preset.name}
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      </Select>

      <TextField value={inputText} onChange={setInputText}>
        <Label className={labelClass}>テキスト</Label>
        <TextArea
          rows={10}
          className="w-full bg-neutral-100 px-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 outline-none focus:bg-white focus:ring-1 focus:ring-sky-300 rounded border border-neutral-200 resize-y leading-relaxed transition-colors"
          placeholder="読み上げるテキストを入力..."
        />
      </TextField>

      <Button
        onPress={handleGenerate}
        isDisabled={!canGenerate}
        className="bg-sky-500 text-white px-5 py-1.5 text-sm font-medium rounded hover:bg-sky-400 pressed:bg-sky-600 outline-none focus-visible:ring-1 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
      >
        {isGenerating ? '生成中...' : '生成'}
      </Button>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 rounded">
          {error}
        </div>
      )}

      <div className="pt-2">
        <p className={labelClass}>生成履歴</p>
        <div className="mt-2 max-h-[400px] overflow-auto">
          <HistoryList />
        </div>
      </div>
    </div>
  );
};
