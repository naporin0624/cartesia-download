import { useAtom, useSetAtom } from 'jotai';
import { useCallback, useEffect, useState, type FC } from 'react';
import { Button, Checkbox, Input, Label, ListBox, ListBoxItem, Popover, Select, SelectValue, TextArea, TextField } from 'react-aria-components';
import { addPresetAtom, deletePresetAtom, fetchSettingsAtom, settingsAtom, updatePresetAtom, updateSettingsAtom } from './atoms';

const inputClass = 'w-full bg-neutral-100 px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 outline-none focus:bg-white focus:ring-1 focus:ring-sky-300 rounded border border-neutral-200 transition-colors';
const labelClass = 'block text-[11px] font-medium tracking-wide text-neutral-500 mb-1.5';
const hintClass = 'text-xs text-neutral-400 mt-1';
const selectBtnClass = 'w-full flex items-center justify-between bg-neutral-100 px-3 py-2 text-sm text-neutral-800 outline-none focus:bg-white focus:ring-1 focus:ring-sky-300 rounded border border-neutral-200 cursor-pointer transition-colors';
const popoverClass = 'w-[var(--trigger-width)] bg-white border border-neutral-200 rounded shadow-lg shadow-neutral-200/60 py-1 outline-none';
const itemClass = 'px-3 py-1.5 text-sm text-neutral-500 outline-none cursor-pointer data-[focused]:bg-sky-50 data-[focused]:text-sky-700 data-[selected]:text-sky-700 data-[selected]:font-medium';
const secondaryBtnClass = 'bg-neutral-100 text-neutral-600 px-3 py-1 text-xs rounded border border-neutral-200 hover:bg-neutral-200 hover:text-neutral-800 pressed:bg-neutral-50 outline-none focus-visible:ring-1 focus-visible:ring-sky-300 cursor-pointer transition-colors';
const dangerBtnClass = 'bg-red-50 text-red-600 px-3 py-1 text-xs rounded border border-red-200 hover:bg-red-100 pressed:bg-red-50 outline-none focus-visible:ring-1 focus-visible:ring-red-400 cursor-pointer transition-colors';
const sectionTitleClass = 'text-[11px] font-medium tracking-widest text-neutral-400';
const primaryBtnClass = 'bg-sky-500 text-white px-4 py-1 text-xs font-medium rounded hover:bg-sky-400 pressed:bg-sky-600 outline-none focus-visible:ring-1 focus-visible:ring-sky-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors';
const linkClass = 'text-sky-600 underline hover:text-sky-500';

interface ModelFormState {
  name: string;
  voiceId: string;
  systemPrompt: string;
}

const emptyForm: ModelFormState = { name: '', voiceId: '', systemPrompt: '' };

const ModelForm: FC<{
  initial: ModelFormState;
  onSubmit: (form: ModelFormState) => void;
  onCancel: () => void;
  submitLabel: string;
}> = ({ initial, onSubmit, onCancel, submitLabel }) => {
  const [form, setForm] = useState(initial);

  const handleField = useCallback((key: keyof ModelFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isValid = form.name.trim() !== '' && form.voiceId.trim() !== '';

  return (
    <div className="space-y-3 bg-neutral-50 border border-neutral-200 p-4 rounded">
      <TextField value={form.name} onChange={(v) => handleField('name', v)}>
        <Label className={labelClass}>モデル名</Label>
        <Input className={inputClass} placeholder="例: ナレーター、キャラA" />
      </TextField>

      <div>
        <TextField value={form.voiceId} onChange={(v) => handleField('voiceId', v)}>
          <Label className={labelClass}>Voice ID</Label>
          <Input className={inputClass} placeholder="例: a0e99841-438c-4a64-b679-ae501e7d6091" />
        </TextField>
        <p className={hintClass}><a href="https://play.cartesia.ai/voices" target="_blank" rel="noopener noreferrer" className={linkClass}>play.cartesia.ai/voices</a> で声を検索し、⋯ から「Copy ID」で取得できます</p>
      </div>

      <div>
        <TextField value={form.systemPrompt} onChange={(v) => handleField('systemPrompt', v)}>
          <Label className={labelClass}>アノテーション指示（任意）</Label>
          <TextArea rows={4} className={`${inputClass} resize-y`} placeholder="感情の付け方をカスタマイズする指示を入力できます。空欄の場合はデフォルトの指示が使われます。" />
        </TextField>
        <p className={hintClass}>AI に「どんな感情で読んでほしいか」を伝える指示文です</p>
      </div>

      <div className="flex gap-2 pt-1">
        <Button onPress={() => onSubmit(form)} isDisabled={!isValid} className={primaryBtnClass}>
          {submitLabel}
        </Button>
        <Button onPress={onCancel} className={secondaryBtnClass}>
          キャンセル
        </Button>
      </div>
    </div>
  );
};

export const SettingsPage: FC = () => {
  const [settings, setSettings] = useAtom(settingsAtom);
  const fetchSettings = useSetAtom(fetchSettingsAtom);
  const updateSettings = useSetAtom(updateSettingsAtom);
  const addPreset = useSetAtom(addPresetAtom);
  const updatePreset = useSetAtom(updatePresetAtom);
  const deletePreset = useSetAtom(deletePresetAtom);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = useCallback(() => {
    updateSettings(settings);
  }, [updateSettings, settings]);

  const handleChange = useCallback(
    (key: string, value: string | number | boolean) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [setSettings],
  );

  const handleAddPreset = useCallback(
    (form: ModelFormState) => {
      addPreset(form);
      setShowAddForm(false);
    },
    [addPreset],
  );

  const handleUpdatePreset = useCallback(
    (id: string, form: ModelFormState) => {
      updatePreset(id, form);
      setEditingId(null);
    },
    [updatePreset],
  );

  const handleDeletePreset = useCallback(
    (id: string) => {
      deletePreset(id);
    },
    [deletePreset],
  );

  return (
    <div className="max-w-lg space-y-8">
      <h1 className="text-lg font-medium text-neutral-900">設定</h1>

      <section className="space-y-5">
        <p className={sectionTitleClass}>API キー</p>

        <div>
          <TextField value={settings.cartesiaApiKey} onChange={(v) => handleChange('cartesiaApiKey', v)} type="password">
            <Label className={labelClass}>Cartesia API Key</Label>
            <Input className={inputClass} placeholder="sk-..." />
          </TextField>
          <p className={hintClass}><a href="https://play.cartesia.ai/keys" target="_blank" rel="noopener noreferrer" className={linkClass}>play.cartesia.ai/keys</a> から作成できます</p>
        </div>

        <div className="space-y-3">
          <Checkbox
            isSelected={settings.annotate}
            onChange={(v) => handleChange('annotate', v)}
            className="group flex items-center gap-2.5 text-sm text-neutral-500 cursor-pointer outline-none"
          >
            <div className="flex size-4 shrink-0 items-center justify-center rounded-sm border border-neutral-300 bg-white group-data-[selected]:bg-sky-500 group-data-[selected]:border-sky-500 transition-colors group-data-[focus-visible]:ring-1 group-data-[focus-visible]:ring-sky-300">
              <svg className="size-2.5 hidden group-data-[selected]:block text-white" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                <path d="M1 5L4.5 8.5L11 1.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="group-data-[selected]:text-neutral-800 transition-colors">感情アノテーション</span>
          </Checkbox>
          <p className="text-xs text-neutral-400 ml-[26px]">
            テキストを AI が分析し、嬉しい・悲しい・驚きなどの感情タグを自動で付けます。
            より自然で表現力豊かな音声が生成されます。
          </p>
        </div>

        {settings.annotate && (
          <div>
            <TextField value={settings.anthropicApiKey} onChange={(v) => handleChange('anthropicApiKey', v)} type="password">
              <Label className={labelClass}>Anthropic API Key</Label>
              <Input className={inputClass} placeholder="sk-ant-..." />
            </TextField>
            <p className={hintClass}><a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className={linkClass}>console.anthropic.com</a> から取得してください（感情アノテーションに必要です）</p>
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div>
          <p className={sectionTitleClass}>ボイスモデル</p>
          <p className="text-xs text-neutral-400 mt-1">
            キャラクターや用途ごとに声と読み方を設定できます
          </p>
        </div>

        {settings.presets.length > 0 && (
          <div className="space-y-2">
            {settings.presets.map((preset) =>
              editingId === preset.id ? (
                <ModelForm
                  key={preset.id}
                  initial={{ name: preset.name, voiceId: preset.voiceId, systemPrompt: preset.systemPrompt }}
                  onSubmit={(form) => handleUpdatePreset(preset.id, form)}
                  onCancel={() => setEditingId(null)}
                  submitLabel="更新"
                />
              ) : (
                <div key={preset.id} className="flex items-center justify-between bg-white border border-neutral-200 px-4 py-3 rounded">
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-800 truncate">{preset.name}</p>
                    <p className="text-xs text-neutral-400 truncate">{preset.voiceId}</p>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-3">
                    <Button onPress={() => setEditingId(preset.id)} className={secondaryBtnClass}>
                      編集
                    </Button>
                    <Button onPress={() => handleDeletePreset(preset.id)} className={dangerBtnClass}>
                      削除
                    </Button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}

        {showAddForm ? (
          <ModelForm initial={emptyForm} onSubmit={handleAddPreset} onCancel={() => setShowAddForm(false)} submitLabel="追加" />
        ) : (
          <Button onPress={() => setShowAddForm(true)} className={secondaryBtnClass}>
            モデルを追加
          </Button>
        )}
      </section>

      <section className="space-y-5">
        <p className={sectionTitleClass}>音声出力</p>

        <div className="grid grid-cols-2 gap-5">
          <Select selectedKey={settings.model} onSelectionChange={(key) => handleChange('model', String(key))}>
            <Label className={labelClass}>音声エンジン</Label>
            <Button className={selectBtnClass}>
              <SelectValue />
              <span className="text-neutral-400 text-xs" aria-hidden="true">&#9662;</span>
            </Button>
            <Popover className={popoverClass}>
              <ListBox>
                <ListBoxItem id="sonic-2" className={itemClass}>sonic-2</ListBoxItem>
                <ListBoxItem id="sonic-3" className={itemClass}>sonic-3</ListBoxItem>
              </ListBox>
            </Popover>
          </Select>

          <Select selectedKey={settings.language} onSelectionChange={(key) => handleChange('language', String(key))}>
            <Label className={labelClass}>言語</Label>
            <Button className={selectBtnClass}>
              <SelectValue />
              <span className="text-neutral-400 text-xs" aria-hidden="true">&#9662;</span>
            </Button>
            <Popover className={popoverClass}>
              <ListBox>
                <ListBoxItem id="ja" className={itemClass}>日本語</ListBoxItem>
                <ListBoxItem id="en" className={itemClass}>English</ListBoxItem>
              </ListBox>
            </Popover>
          </Select>
        </div>

        <Select selectedKey={String(settings.sampleRate)} onSelectionChange={(key) => handleChange('sampleRate', Number(key))}>
          <Label className={labelClass}>サンプルレート</Label>
          <Button className={selectBtnClass}>
            <SelectValue />
            <span className="text-neutral-400 text-xs" aria-hidden="true">&#9662;</span>
          </Button>
          <Popover className={popoverClass}>
            <ListBox>
              <ListBoxItem id="22050" className={itemClass}>22050 Hz</ListBoxItem>
              <ListBoxItem id="44100" className={itemClass}>44100 Hz</ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
      </section>

      <Button
        onPress={handleSave}
        className="bg-sky-500 text-white px-5 py-1.5 text-sm font-medium rounded hover:bg-sky-400 pressed:bg-sky-600 outline-none focus-visible:ring-1 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 cursor-pointer transition-colors"
      >
        保存
      </Button>
    </div>
  );
};
