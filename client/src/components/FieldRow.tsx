import { useId } from 'react';
import type { ExtractedField } from '@shared/types';
import { LEGEND } from '@shared/legend';
import { isLowConfidence, regNoLooksOdd, type FieldDef } from '@/lib/fields';

function ConfidenceDot({ confidence }: { confidence: number }) {
  // Brand greens for confident reads; amber tint for "please look at this".
  const color = confidence >= 0.9 ? '#477023' : confidence >= 0.8 ? '#6E8649' : LEGEND.amber.color;
  return <span className="inline-block size-2 rounded-full" style={{ background: color }} aria-hidden="true" />;
}

export function FieldRow({
  def,
  field,
  reviewed,
  onChange,
  onReview,
}: {
  def: FieldDef;
  field: ExtractedField | undefined;
  reviewed: boolean;
  onChange: (value: string) => void;
  onReview: () => void;
}) {
  const id = useId();
  const value = field?.value ?? '';
  const fromAi = typeof field?.confidence === 'number' && !field.editedByUser;
  const needsLook = isLowConfidence(field) && !reviewed;
  const oddRegNo = def.key === 'nafdacRegNo' && regNoLooksOdd(field?.value ?? null);
  const missingRegNo = def.key === 'nafdacRegNo' && !value.trim();
  const amber = LEGEND.amber;

  return (
    <div
      className="grid gap-1.5 rounded-[12px] border bg-white p-3 transition-colors"
      style={needsLook ? { background: amber.background, borderColor: '#F3D27A' } : { borderColor: 'var(--color-line)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="flex items-center gap-2 text-[13px] font-semibold text-muted">
          {def.label}
          {def.optional && <span className="font-normal">(optional)</span>}
        </label>
        {fromAi && (
          <span className="flex items-center gap-1.5 text-[12px] text-muted" title={`AI confidence ${Math.round(field!.confidence! * 100)}%`}>
            <ConfidenceDot confidence={field!.confidence!} />
            <span className="rounded bg-mist px-1.5 py-px text-[10.5px] font-bold tracking-[0.04em] text-moss">AI</span>
            <span className="tabular">{Math.round(field!.confidence! * 100)}%</span>
          </span>
        )}
        {field?.editedByUser && <span className="text-[12px] font-semibold text-fern">Edited</span>}
      </div>
      <input
        id={id}
        value={value}
        placeholder={def.placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onReview}
        autoComplete="off"
        autoCapitalize={def.mono ? 'characters' : 'words'}
        spellCheck={false}
        className={`min-h-11 w-full rounded-[10px] border border-line bg-white px-3 text-[17px] font-semibold placeholder:font-normal placeholder:text-[#9aa894] focus:border-fern focus:outline-none ${def.mono ? 'font-mono tracking-[0.02em]' : ''}`}
      />
      {fromAi && field?.sourceText && field.sourceText !== field.value && (
        <p className="text-[12.5px] text-muted">
          AI read: <span className="font-mono">“{field.sourceText}”</span>
        </p>
      )}
      {needsLook && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold" style={{ color: amber.text }}>
            The AI wasn't sure. Check this against the pack.
          </p>
          <button
            type="button"
            onClick={onReview}
            className="min-h-9 shrink-0 rounded-lg border px-3 text-[13px] font-bold"
            style={{ borderColor: amber.color, color: amber.text }}
          >
            Looks right
          </button>
        </div>
      )}
      {missingRegNo && (
        <p className="text-[13px] text-muted">{def.hint} You can still check without it, but we won't be able to say much.</p>
      )}
      {oddRegNo && <p className="text-[13px] text-muted">NAFDAC numbers usually look like A4-6238 or 04-1234. Double-check it.</p>}
    </div>
  );
}
