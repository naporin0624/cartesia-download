import { useAtomValue, useSetAtom } from 'jotai';
import { useCallback, type FC } from 'react';
import { Button, Checkbox, Input, Label, TextArea, TextField } from 'react-aria-components';
import { isDirtyAtom, selectedEditFormAtom, selectedOriginalFormAtom, selectedVoiceIdAtom, updateEditFormAtom, updateVoiceAtom } from './atoms';

const inputClass =
  'w-full bg-neutral-100 px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 outline-none focus:bg-white focus:ring-1 focus:ring-sky-300 rounded border border-neutral-200 transition-colors';
const labelClass = 'block text-[11px] font-medium tracking-wide text-neutral-500 mb-1.5';

export const VoicesPage: FC = () => {
  const selectedId = useAtomValue(selectedVoiceIdAtom);
  const original = useAtomValue(selectedOriginalFormAtom);
  const form = useAtomValue(selectedEditFormAtom);
  const dirty = useAtomValue(isDirtyAtom);
  const updateForm = useSetAtom(updateEditFormAtom);
  const updateVoice = useSetAtom(updateVoiceAtom);

  const handleNameChange = useCallback((v: string) => updateForm({ name: v }), [updateForm]);
  const handleDescriptionChange = useCallback((v: string) => updateForm({ description: v }), [updateForm]);
  const handleIsPublicChange = useCallback((v: boolean) => updateForm({ isPublic: v }), [updateForm]);
  const handleSave = useCallback(() => updateVoice(), [updateVoice]);

  if (!selectedId || !form) {
    return (
      <div className="max-w-lg">
        <h1 className="text-lg font-medium text-neutral-900 mb-4">モデル管理</h1>
        <p className="text-sm text-neutral-400">サイドバーからモデルを選択してください</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="text-lg font-medium text-neutral-900">{original?.name ?? 'モデル編集'}</h1>
        <p className="text-xs text-neutral-400 mt-1">{selectedId}</p>
      </div>

      <section className="space-y-5">
        <TextField value={form.name} onChange={handleNameChange}>
          <Label className={labelClass}>名前</Label>
          <Input className={inputClass} />
        </TextField>

        <Checkbox isSelected={form.isPublic} onChange={handleIsPublicChange} className="group flex items-center gap-2.5 text-sm text-neutral-500 cursor-pointer outline-none">
          <div className="flex size-4 shrink-0 items-center justify-center rounded-sm border border-neutral-300 bg-white group-data-[selected]:bg-sky-500 group-data-[selected]:border-sky-500 transition-colors group-data-[focus-visible]:ring-1 group-data-[focus-visible]:ring-sky-300">
            <svg className="size-2.5 hidden group-data-[selected]:block text-white" viewBox="0 0 12 10" fill="none" aria-hidden="true">
              <path d="M1 5L4.5 8.5L11 1.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="group-data-[selected]:text-neutral-800 transition-colors">公開する</span>
        </Checkbox>

        <TextField value={form.description} onChange={handleDescriptionChange}>
          <Label className={labelClass}>説明</Label>
          <TextArea rows={4} className={`${inputClass} resize-y`} />
        </TextField>
      </section>

      <Button
        onPress={handleSave}
        isDisabled={!dirty}
        className="bg-sky-500 text-white px-5 py-1.5 text-sm font-medium rounded hover:bg-sky-400 pressed:bg-sky-600 outline-none focus-visible:ring-1 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
      >
        保存
      </Button>
    </div>
  );
};
