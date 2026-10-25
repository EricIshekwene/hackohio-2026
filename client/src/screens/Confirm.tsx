import { Checkbox } from '@base-ui/react/checkbox';
import { Collapsible } from '@base-ui/react/collapsible';
import type { FieldKey } from '@shared/types';
import { FIELD_DEFS, isLowConfidence, type Fields } from '@/lib/fields';
import { FieldRow } from '@/components/FieldRow';
import { Button } from '@/components/ui';
import { Shell } from '@/components/Shell';

export function Confirm({
  source,
  fields,
  reviewed,
  attested,
  photoUrl,
  error,
  checking,
  onBack,
  onEdit,
  onReview,
  onAttest,
  onCheck,
}: {
  source: 'photo' | 'manual';
  fields: Fields;
  reviewed: FieldKey[];
  attested: boolean;
  photoUrl: string | null;
  error: string | null;
  checking: boolean;
  onBack: () => void;
  onEdit: (key: FieldKey, value: string) => void;
  onReview: (key: FieldKey) => void;
  onAttest: (v: boolean) => void;
  onCheck: () => void;
}) {
  const required = FIELD_DEFS.filter((d) => !d.optional);
  const optional = FIELD_DEFS.filter((d) => d.optional);
  const unreviewed = FIELD_DEFS.filter((d) => isLowConfidence(fields[d.key]) && !reviewed.includes(d.key)).length;
  const anyValue = FIELD_DEFS.some((d) => fields[d.key]?.value?.trim());
  const canAttest = unreviewed === 0 && anyValue;
  const optionalFilled = optional.some((d) => fields[d.key]?.value);

  const row = (d: (typeof FIELD_DEFS)[number]) => (
    <FieldRow
      key={d.key}
      def={d}
      field={fields[d.key]}
      reviewed={reviewed.includes(d.key)}
      onChange={(v) => onEdit(d.key, v)}
      onReview={() => onReview(d.key)}
    />
  );

  return (
    <Shell
      step={checking ? 3 : 2}
      onBack={checking ? undefined : onBack}
      title={source === 'photo' ? 'Does this match your pack?' : 'Type what’s on the pack'}
      subtitle={source === 'photo' ? 'Fix anything the AI got wrong. Nothing is checked until you confirm.' : 'Copy each detail exactly as printed. Leave a field empty if it isn’t on the pack.'}
      footer={
        <>
          <Checkbox.Root
            checked={attested}
            disabled={!canAttest || checking}
            onCheckedChange={(v) => onAttest(v)}
            className="flex min-h-12 items-center gap-3 rounded-[10px] border-[1.5px] border-primary bg-mist px-3 text-left text-[15px] font-bold text-ink data-[disabled]:border-line data-[disabled]:bg-white data-[disabled]:text-muted"
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-md border-[1.5px] border-primary bg-white" aria-hidden="true">
              <Checkbox.Indicator className="grid size-full place-items-center rounded-[4px] bg-primary text-[14px] text-white">✓</Checkbox.Indicator>
            </span>
            {unreviewed > 0
              ? `Check the ${unreviewed} highlighted ${unreviewed === 1 ? 'field' : 'fields'} first`
              : 'These details match the pack'}
          </Checkbox.Root>
          <Button onClick={onCheck} disabled={!attested || checking} aria-busy={checking}>
            {checking ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                Checking NAFDAC records…
              </>
            ) : (
              'Check against NAFDAC'
            )}
          </Button>
        </>
      }
    >
      {photoUrl && source === 'photo' && (
        <div className="flex items-center gap-3">
          <img src={photoUrl} alt="Your photo of the pack" className="h-14 w-16 rounded-lg border border-line object-cover" />
          <p className="text-[13px] text-muted">Compare each field with the pack in your hand, not just the photo.</p>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-card border border-line bg-white p-3 text-[14px] font-semibold">
          {error}
        </p>
      )}
      <fieldset disabled={checking} className="grid gap-3">
        {required.map(row)}
        <Collapsible.Root defaultOpen={optionalFilled} className="grid gap-3">
          <Collapsible.Trigger className="flex min-h-11 items-center justify-between rounded-[12px] border border-dashed border-line px-3 text-[14px] font-semibold text-moss">
            More details from the pack (optional)
            <span aria-hidden="true">+</span>
          </Collapsible.Trigger>
          <Collapsible.Panel className="grid gap-3">{optional.map(row)}</Collapsible.Panel>
        </Collapsible.Root>
      </fieldset>
    </Shell>
  );
}
