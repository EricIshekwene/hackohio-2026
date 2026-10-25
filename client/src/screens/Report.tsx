import { useEffect, useId, useRef, useState } from 'react';
import { Copy, Mail, Phone, Share, UserRound } from 'lucide-react';
import type { ReportDraft, StandardizedMedicationInput, VerificationResult } from '@shared/types';
import { draftReport, RequestError } from '@/lib/api';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Shell } from '@/components/app-shell';
import { VerdictIcon } from '@/components/verdict';
import { cn } from '@/lib/utils';

interface Details {
  name: string;
  phone: string;
  location: string;
  whereBought: string;
}
const NO_DETAILS: Details = { name: '', phone: '', location: '', whereBought: '' };

function LabeledInput({ label, value, onChange, ...rest }: { label: string; value: string; onChange: (v: string) => void } & Omit<React.ComponentProps<typeof Input>, 'onChange' | 'value'>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-foot font-medium text-ink-2">
        {label}
      </label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}

export function Report({ input, result, onBack }: { input: StandardizedMedicationInput; result: VerificationResult; onBack: () => void }) {
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [details, setDetails] = useState<Details>(NO_DETAILS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);
  const subjectId = useId();
  const bodyId = useId();

  async function makeDraft(d: Details) {
    setError(null);
    try {
      const next = await draftReport({
        input,
        result,
        reporter: { name: d.name || undefined, phone: d.phone || undefined, location: d.location || undefined },
        whereBought: d.whereBought || undefined,
      });
      setDraft(next);
      setSubject(next.subject);
      setBody(next.body);
    } catch (e) {
      setError(e instanceof RequestError ? e.message : "We couldn't draft the report. Try again.");
    }
  }

  // Draft straight away; the personal details are optional and can come later.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    makeDraft(NO_DETAILS);
  }, []);

  // Add the details without throwing away the user's own edits to the message.
  async function applyDetails() {
    setSheetOpen(false);
    if (draft && body === draft.body && subject === draft.subject) return makeDraft(details);
    const lines = [
      details.name && `Name: ${details.name}`,
      details.phone && `Phone: ${details.phone}`,
      details.location && `Location: ${details.location}`,
      details.whereBought && `Where bought: ${details.whereBought}`,
    ].filter(Boolean);
    if (lines.length) setBody((b) => `${b.trimEnd()}\n\nMy details:\n${lines.join('\n')}`);
  }

  const text = `${subject}\n\n${body}`;
  const mailto = draft ? `mailto:${draft.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : undefined;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function copyOrShare() {
    if (canShare) {
      await navigator.share({ title: subject, text }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      document.getElementById(bodyId)?.focus();
      (document.getElementById(bodyId) as HTMLTextAreaElement | null)?.select();
    }
  }

  const filled = Object.values(details).filter(Boolean).length;

  return (
    <Shell
      onBack={onBack}
      title="Report to NAFDAC"
      description="We drafted it for you. Read it, change anything, then send it yourself."
      className="gap-3"
      footer={
        <>
          <div className="grid grid-cols-2 gap-2">
            <a href={draft?.tel ?? 'tel:0800-162-3322'} className={buttonVariants({ variant: 'secondary' })}>
              <Phone strokeWidth={1.75} />
              Call NAFDAC
            </a>
            <a href={mailto} aria-disabled={!draft} className={cn(buttonVariants(), !draft && 'pointer-events-none opacity-40')}>
              <Mail strokeWidth={1.75} />
              Send email
            </a>
          </div>
          <Button variant="ghost" block onClick={copyOrShare} disabled={!draft}>
            {canShare ? <Share strokeWidth={1.75} /> : <Copy strokeWidth={1.75} />}
            {copied ? 'Copied' : canShare ? 'Share, e.g. on WhatsApp' : 'Copy the message'}
          </Button>
          <p className="text-center text-cap text-ink-3">Nothing is sent until you press send yourself.</p>
        </>
      }
    >
      <div className="flex items-center gap-3 rounded-md bg-fill px-3.5 py-3">
        <VerdictIcon legend={result.legend} size={22} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body font-medium">{input.fields.productName?.value || 'Unnamed product'}</span>
          {/* Wraps instead of truncating: the phone number must stay readable at 390px. */}
          <span className="text-cap text-ink-2 tabular [overflow-wrap:anywhere]">
            {result.legend.label} · To {draft?.to ?? 'NAFDAC'} · <span className="whitespace-nowrap">{draft?.phone ?? '0800-162-3322'}</span>
          </span>
        </span>
      </div>

      {error ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-md p-3.5 shadow-[inset_0_0_0_1px_var(--color-line)]">
          <p className="text-body">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => makeDraft(details)}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={subjectId} className="text-foot font-medium text-ink-2">
              Subject
            </label>
            <Input id={subjectId} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!draft} placeholder="Drafting…" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <label htmlFor={bodyId} className="text-foot font-medium text-ink-2">
              Message
            </label>
            <Textarea id={bodyId} value={body} onChange={(e) => setBody(e.target.value)} disabled={!draft} placeholder="Drafting…" className="min-h-[180px] flex-1 text-foot leading-[20px]" />
          </div>
        </>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger className="flex h-11 items-center gap-2 rounded-md px-1 text-left text-body font-medium">
          <UserRound className="size-[18px]" strokeWidth={1.75} />
          <span className="flex-1">Add your details</span>
          <span className="text-foot text-ink-3">{filled ? `${filled} added` : 'Optional'}</span>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Your details</SheetTitle>
            <SheetDescription>Optional. They go into the message so NAFDAC can follow up. We don't store them.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <LabeledInput label="Your name" value={details.name} onChange={(v) => setDetails({ ...details, name: v })} autoComplete="name" />
            <LabeledInput label="Phone" value={details.phone} onChange={(v) => setDetails({ ...details, phone: v })} type="tel" autoComplete="tel" />
            <LabeledInput label="Your town or area" value={details.location} onChange={(v) => setDetails({ ...details, location: v })} />
            <LabeledInput label="Where you bought it" value={details.whereBought} onChange={(v) => setDetails({ ...details, whereBought: v })} placeholder="e.g. a pharmacy on Ojuelegba Rd" />
            <Button block onClick={applyDetails}>
              Add to the message
            </Button>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </Shell>
  );
}
