import { useId, useState, type InputHTMLAttributes } from 'react';
import type { ReportDraft, StandardizedMedicationInput, VerificationResult } from '@shared/types';
import { draftReport, RequestError } from '@/lib/api';
import { VerdictIcon } from '@/components/verdict';
import { Button, Card, SectionLabel } from '@/components/ui';
import { Shell } from '@/components/Shell';

function Field({ label, multiline, value, onChange, ...rest }: { label: string; multiline?: boolean; value: string; onChange: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  const id = useId();
  const cls = 'w-full rounded-[10px] border border-line bg-white px-3 text-[16px] focus:border-fern focus:outline-none';
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-[13px] font-semibold text-muted">
        {label}
      </label>
      {multiline ? (
        <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={14} className={`${cls} py-2.5 text-[14.5px] leading-relaxed`} />
      ) : (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${cls} min-h-11`} {...rest} />
      )}
    </div>
  );
}

export function Report({ input, result, onBack }: { input: StandardizedMedicationInput; result: VerificationResult; onBack: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [whereBought, setWhereBought] = useState('');
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const detail = (set: (v: string) => void) => (v: string) => {
    set(v);
    if (draft) setStale(true);
  };

  async function makeDraft() {
    setLoading(true);
    setError(null);
    try {
      const d = await draftReport({
        input,
        result,
        reporter: { name: name || undefined, phone: phone || undefined, location: location || undefined },
        whereBought: whereBought || undefined,
      });
      setDraft(d);
      setSubject(d.subject);
      setBody(d.body);
      setStale(false);
    } catch (e) {
      setError(e instanceof RequestError ? e.message : "We couldn't draft the report. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // Built from the edited text, so what opens in the mail app is what the user reviewed.
  const mailto = draft ? `mailto:${draft.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : '#';

  return (
    <Shell onBack={onBack} title="Report to NAFDAC" subtitle="We draft it. You review every word and send it yourself.">
      <Card className="flex items-center gap-3">
        <VerdictIcon legend={result.legend} size={28} />
        <div className="grid">
          <span className="text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: result.legend.text }}>
            {result.legend.label}
          </span>
          <span className="font-semibold">{input.fields.productName.value || 'Unnamed product'}</span>
        </div>
      </Card>

      <section className="grid gap-3">
        <SectionLabel>Your details (optional)</SectionLabel>
        <p className="text-[14px] text-muted">These go into the email so NAFDAC can follow up. We don't store them.</p>
        <Field label="Your name" value={name} onChange={detail(setName)} autoComplete="name" />
        <Field label="Phone" value={phone} onChange={detail(setPhone)} type="tel" autoComplete="tel" />
        <Field label="Your town or area" value={location} onChange={detail(setLocation)} />
        <Field label="Where you bought it" value={whereBought} onChange={detail(setWhereBought)} placeholder="e.g. a pharmacy on Ojuelegba Rd" />
        {(!draft || stale) && (
          <Button onClick={makeDraft} disabled={loading} variant={draft ? 'secondary' : 'primary'}>
            {loading ? 'Drafting…' : draft ? 'Redo the draft with these details' : 'Draft the report'}
          </Button>
        )}
        {stale && <p className="text-[13px] text-muted">Redoing the draft replaces any edits you made below.</p>}
        {error && <p role="alert" className="text-[14px] font-semibold">{error}</p>}
      </section>

      {draft && (
        <section className="rise grid gap-3">
          <SectionLabel>Review before sending</SectionLabel>
          <p className="text-[14px]">
            To: <span className="font-semibold">{draft.to}</span>
          </p>
          <Field label="Subject" value={subject} onChange={setSubject} />
          <Field label="Message" multiline value={body} onChange={setBody} />
          <div className="grid gap-2">
            <a href={mailto} className="inline-flex min-h-12 items-center justify-center rounded-[10px] bg-primary px-4 text-[15px] font-semibold text-white hover:bg-moss">
              Send email
            </a>
            <a href={draft.tel} className="inline-flex min-h-12 items-center justify-center rounded-[10px] border border-line bg-white px-4 text-[15px] font-semibold text-ink hover:border-moss">
              Call NAFDAC · {draft.phone}
            </a>
          </div>
          <p className="text-[12.5px] text-muted">Nothing is sent until you press send in your email app.</p>
        </section>
      )}
    </Shell>
  );
}
