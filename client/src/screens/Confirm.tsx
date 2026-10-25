import { useEffect, useId } from 'react';
import { ChevronRight, Info, Plus } from 'lucide-react';
import type { ExtractedField, ExtractionInfo, FieldKey } from '@shared/types';
import { LEGEND } from '@shared/legend';
import { FIELD_DEFS, isLowConfidence, regNoLooksOdd, type FieldDef, type Fields } from '@/lib/fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Sheet, SheetBody, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Shell, type StepInfo } from '@/components/app-shell';
import type { Photo } from '@/lib/photos';
import { cn } from '@/lib/utils';

// The server's own read of the photo quality, said once where the user looks at the photos.
const PHOTO_NOTE: Partial<Record<ExtractionInfo['photoStatus'], string>> = {
  blurry: 'Some text was blurry. Compare each detail with the pack.',
  glare: 'Glare hid some text. Compare each detail with the pack.',
  partial: 'Part of the pack was cut off. Compare each detail with the pack.',
};

const amber = LEGEND.amber;

// One row of the inset group: label above an inline input, with where the value came from on the right.
function FieldRow({ def, field, needsLook, onChange, onReview }: { def: FieldDef; field: ExtractedField | undefined; needsLook: boolean; onChange: (v: string) => void; onReview: () => void }) {
  const id = useId();
  // Only worth flagging an edit when the value first came from the photo.
  const fromAiSource = typeof field?.confidence === 'number';
  return (
    <div className={cn('flex items-center gap-3 border-b border-line px-4 py-1.5 last:border-b-0', needsLook && 'bg-[var(--amber-bg)]')} style={{ '--amber-bg': amber.background } as React.CSSProperties}>
      <div className="flex min-w-0 flex-1 flex-col">
        <label htmlFor={id} className="text-cap" style={{ color: needsLook ? amber.text : 'var(--color-ink-3)' }}>
          {def.label}
          {needsLook && ' · check this against the pack'}
        </label>
        <input
          id={id}
          data-field={def.key}
          value={field?.value ?? ''}
          placeholder={def.placeholder}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          autoCapitalize={def.mono ? 'characters' : 'words'}
          spellCheck={false}
          className={cn('h-7 w-full min-w-0 bg-transparent text-[16px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-3', def.mono && 'tabular tracking-[0.01em]')}
        />
        {needsLook && field?.sourceText && field.sourceText !== field.value && (
          <span className="text-cap" style={{ color: amber.text }}>
            Read as “{field.sourceText}”
          </span>
        )}
        {needsLook &&
          field?.notes?.map((note) => (
            <span key={note} className="text-cap" style={{ color: amber.text }}>
              {note}
            </span>
          ))}
      </div>
      {needsLook ? (
        <Button size="sm" variant="secondary" onClick={onReview} className="bg-white">
          Looks right
        </Button>
      ) : field?.editedByUser && fromAiSource ? (
        <Badge>Edited</Badge>
      ) : null}
    </div>
  );
}

export function Confirm({
  step,
  source,
  fields,
  reviewed,
  attested,
  attestCleared,
  photos,
  extraction,
  error,
  onBack,
  onEdit,
  onReview,
  onAttest,
  onCheck,
}: {
  step: StepInfo;
  source: 'photo' | 'manual';
  fields: Fields;
  reviewed: FieldKey[];
  attested: boolean;
  attestCleared: boolean;
  photos: Photo[];
  extraction: ExtractionInfo | null;
  error: string | null;
  onBack: () => void;
  onEdit: (key: FieldKey, value: string) => void;
  onReview: (key: FieldKey) => void;
  onAttest: (v: boolean) => void;
  onCheck: () => void;
}) {
  const attestId = useId();
  const shown = photos;
  const photoNote = source === 'photo' && extraction ? PHOTO_NOTE[extraction.photoStatus] : undefined;
  const required = FIELD_DEFS.filter((d) => !d.optional);
  const optional = FIELD_DEFS.filter((d) => d.optional);
  const needsLook = (d: FieldDef) => isLowConfidence(fields[d.key]) && !reviewed.includes(d.key);
  const unreviewed = FIELD_DEFS.filter(needsLook).length;
  const anyValue = FIELD_DEFS.some((d) => fields[d.key]?.value?.trim());
  const canAttest = unreviewed === 0 && anyValue;
  const optionalFilled = optional.filter((d) => fields[d.key]?.value?.trim()).length;
  const regNo = fields.nafdacRegNo?.value ?? '';
  const regHint = !regNo.trim()
    ? "No NAFDAC number? You can still check, but we won't be able to say much."
    : regNoLooksOdd(regNo)
      ? 'NAFDAC numbers usually look like A4-6238 or 04-1234. Double-check it.'
      : null;

  // Coming back from "Add the NAFDAC number": put the cursor where it's needed.
  useEffect(() => {
    if (anyValue && !regNo.trim()) document.querySelector<HTMLInputElement>('[data-field="nafdacRegNo"]')?.focus();
    // Only on arrival.
  }, []);

  // Say why the button can't be pressed, right next to it.
  const status = error
    ? error
    : !anyValue
      ? 'Fill in what you can see on the pack.'
      : unreviewed > 0
        ? `Look at the ${unreviewed === 1 ? 'highlighted field' : `${unreviewed} highlighted fields`} first.`
        : attestCleared
          ? 'You changed a detail. Tick the box again to check.'
          : !attested
            ? 'Nothing is sent until you tick the box.'
            : null;

  return (
    <Shell
      step={step}
      onBack={onBack}
      title={source === 'photo' ? 'Check what we read' : 'Type what’s on the pack'}
      description={source === 'photo' ? `We read these from your ${shown.length > 1 ? 'photos' : 'photo'}. Fix anything that’s wrong.` : 'The NAFDAC number matters most. Fill in what you can see.'}
      className="gap-3"
      footer={
        <>
          <label
            htmlFor={attestId}
            className={cn('flex items-center gap-3 rounded-md px-3.5 py-3 transition-colors', attested ? 'bg-fill' : 'shadow-[inset_0_0_0_1px_var(--color-line)]', !canAttest && 'opacity-50')}
          >
            <Checkbox id={attestId} checked={attested} disabled={!canAttest} onCheckedChange={(v) => onAttest(v)} />
            <span className="text-body font-medium">These details match the pack</span>
          </label>
          <Button block onClick={onCheck} disabled={!attested}>
            Check with NAFDAC
          </Button>
          <p role={error ? 'alert' : 'status'} className={cn('min-h-[18px] text-center text-foot', error ? 'font-medium text-ink' : 'text-ink-3')}>
            {status}
          </p>
        </>
      }
    >
      {shown.length > 0 && (
        <Sheet>
          <SheetTrigger className="flex items-center gap-3 rounded-md px-1 text-left">
            <span className="flex shrink-0 -space-x-5">
              {shown.map((p) => (
                <img key={p.id} src={p.url} alt="" className="size-11 rounded-sm object-cover shadow-[0_0_0_1.5px_white,0_0_0_2.5px_var(--color-line)]" />
              ))}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body font-medium">{shown.length === 1 ? 'Your photo' : `Your ${shown.length} photos`}</span>
              <span className={cn('text-cap', photoNote ? 'font-medium text-ink' : 'text-ink-3')}>{photoNote ?? 'Tap to zoom in and copy from them'}</span>
            </span>
            <ChevronRight className="size-4 text-ink-3" />
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{shown.length === 1 ? 'Your photo' : 'Your photos'}</SheetTitle>
              <SheetDescription>Pinch to zoom. Compare each detail with the pack itself too.</SheetDescription>
            </SheetHeader>
            <SheetBody>
              {shown.map((p) => (
                <img key={p.id} src={p.url} alt="Your photo of the pack" className="w-full rounded-md bg-stage object-contain" />
              ))}
            </SheetBody>
          </SheetContent>
        </Sheet>
      )}

      <div className="overflow-hidden rounded-lg border border-line">
        {required.map((d) => (
          <FieldRow key={d.key} def={d} field={fields[d.key]} needsLook={needsLook(d)} onChange={(v) => onEdit(d.key, v)} onReview={() => onReview(d.key)} />
        ))}
      </div>

      {regHint && (
        <p className="flex items-start gap-2 text-foot text-ink-2">
          <Info className="mt-px size-4 shrink-0" strokeWidth={1.75} />
          {regHint}
        </p>
      )}

      <Sheet>
        <SheetTrigger className="flex h-11 items-center gap-2 rounded-md px-1 text-left text-body font-medium text-ink">
          <Plus className="size-[18px]" strokeWidth={1.75} />
          <span className="flex-1">More details from the pack</span>
          <span className="text-foot text-ink-3">{optionalFilled ? `${optionalFilled} added` : 'Optional'}</span>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>More details</SheetTitle>
            <SheetDescription>Optional. If the pack shows these, they make the comparison sharper.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            {optional.map((d) => (
              <OptionalField key={d.key} def={d} field={fields[d.key]} onChange={(v) => onEdit(d.key, v)} />
            ))}
            <SheetClose render={<Button block />}>Done</SheetClose>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </Shell>
  );
}

function OptionalField({ def, field, onChange }: { def: FieldDef; field: ExtractedField | undefined; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-foot font-medium text-ink-2">
        {def.label}
      </label>
      <Input id={id} value={field?.value ?? ''} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
    </div>
  );
}
