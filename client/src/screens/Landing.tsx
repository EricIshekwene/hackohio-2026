import { useEffect, useState } from 'react';
import { Camera, FileSearch, Keyboard, ListChecks } from 'lucide-react';
import { CAVEAT } from '@shared/legend';
import { DEMO_PACKS, getMeta, USE_MOCKS, type DemoPackId, type Meta } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shell } from '@/components/app-shell';

// How it works, in the order the user meets it. Black glyphs on a quiet tile; green stays for the brand mark.
const STEPS = [
  { icon: Camera, title: 'Photograph the pack', body: '1 to 3 photos, any side.' },
  { icon: ListChecks, title: 'Confirm what we read', body: 'Nothing is checked until you do.' },
  { icon: FileSearch, title: 'Checked against NAFDAC', body: 'Registry and alerts, with the evidence.' },
];

// Demo packs are for the video: always in mock mode, or with ?demo on the real server.
const SHOW_DEMOS = USE_MOCKS || new URLSearchParams(location.search).has('demo');

export function Landing({ onStart, onManual, onDemo }: { onStart: () => void; onManual: () => void; onDemo: (id: DemoPackId) => void }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    getMeta().then(setMeta).catch(() => setMeta(null));
  }, []);

  // Only what /api/meta actually says; nothing is shown until it answers.
  const trust = meta && [
    meta.registry?.total ? `${meta.registry.total.toLocaleString('en-NG')} registered products` : null,
    `Data as of ${formatDate(meta.dataAsOf.registrySnapshot)}`,
  ].filter(Boolean);

  return (
    <Shell
      trailing={USE_MOCKS && <Badge variant="outline">Demo data</Badge>}
      className="gap-6 pt-6"
      footer={
        <>
          <Button block onClick={onStart}>
            <Camera strokeWidth={1.75} />
            Scan a pack
          </Button>
          <Button block variant="secondary" onClick={onManual}>
            <Keyboard strokeWidth={1.75} />
            Type the details
          </Button>
          {SHOW_DEMOS && (
            <div className="mt-1 flex items-center">
              <div aria-label="Demo packs" role="group" className="grid flex-1 grid-cols-3 divide-x divide-line overflow-hidden rounded-md shadow-[inset_0_0_0_1px_var(--color-line)]">
                {DEMO_PACKS.map((p) => (
                  <button key={p.id} type="button" onClick={() => onDemo(p.id)} className="h-9 px-1 text-cap font-medium whitespace-nowrap text-ink hover:bg-fill">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="mt-1 text-center text-[11px] leading-4 text-ink-3">{CAVEAT}. MedCheck never says a medicine is genuine or safe.</p>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <h1 className="text-[30px] leading-[34px] font-semibold tracking-[-0.03em]">
          Check a medicine pack <span className="text-ink-3">against NAFDAC’s records.</span>
        </h1>
        <p className="text-body text-ink-2">Fakes often copy a real registration number. MedCheck compares the pack with what NAFDAC registered and shows any difference.</p>
      </div>

      <ol className="flex flex-col gap-3.5">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-fill shadow-[inset_0_0_0_1px_var(--color-line)]">
              <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5 pt-px">
              <span className="text-body font-medium">
                <span className="tabular text-ink-3">{i + 1}&nbsp;&nbsp;</span>
                {title}
              </span>
              <span className="text-foot text-ink-3">{body}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="flex min-h-[34px] items-center gap-2 border-t border-line pt-4 text-cap whitespace-nowrap text-ink-3" aria-live="polite">
        {trust?.map((t, i) => (
          <span key={t} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true" className="size-[3px] rounded-full bg-ink-3/60" />}
            <span className={i === 0 ? 'flex items-center gap-1.5 font-medium text-ink-2' : 'tabular'}>
              {i === 0 && <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />}
              {t}
            </span>
          </span>
        ))}
      </div>
    </Shell>
  );
}
