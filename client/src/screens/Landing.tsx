import { useEffect, useState } from 'react';
import { Camera, Keyboard } from 'lucide-react';
import { CAVEAT, LEGEND } from '@shared/legend';
import { DEMO_PACKS, getMeta, USE_MOCKS, type DemoPackId, type Meta } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataFooter, Shell } from '@/components/app-shell';
import { VerdictIcon } from '@/components/verdict';

// What the app does, shown with a real result instead of clip art: the hero demo pack's two mismatches.
function ResultPreview() {
  const red = LEGEND.red;
  const rows = [
    ['Reg. no.', 'A4-6238', 'A4-6238', true],
    ['Product', 'Lonart Forte', 'Artheget EZ', false],
    ['Maker', 'Greenlife Pharma', 'Getz Pharma', false],
  ] as const;
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-lg border border-line text-foot">
      <div className="flex items-center gap-2.5 bg-fill px-3 py-3">
        <VerdictIcon legend={red} size={20} />
        <span className="font-semibold text-ink">Do not use this medicine</span>
        <span className="ml-auto text-cap text-ink-3">Example result</span>
      </div>
      <div>
        <div className="grid grid-cols-[72px_1fr_1fr] gap-2 border-t border-line px-3 py-2 text-cap text-ink-3">
          <span>Field</span>
          <span>On the pack</span>
          <span>NAFDAC record</span>
        </div>
        {rows.map(([f, pack, rec, ok]) => (
          <div key={f} className="grid grid-cols-[72px_1fr_1fr] gap-2 border-t border-line px-3 py-2.5" style={ok ? undefined : { background: red.background, color: red.text }}>
            <span className={ok ? 'text-ink-2' : 'font-medium'}>{f}</span>
            <span className={ok ? '' : 'font-medium'}>{pack}</span>
            <span className={ok ? '' : 'font-medium'}>{rec}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Demo packs are for the video: always in mock mode, or with ?demo on the real server.
const SHOW_DEMOS = USE_MOCKS || new URLSearchParams(location.search).has('demo');

export function Landing({ onStart, onManual, onDemo }: { onStart: () => void; onManual: () => void; onDemo: (id: DemoPackId) => void }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    getMeta().then(setMeta).catch(() => setMeta(null));
  }, []);

  return (
    <Shell
      trailing={USE_MOCKS && <Badge variant="outline">Demo data</Badge>}
      className="pt-3"
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
          {SHOW_DEMOS && (<div className="mt-3 flex flex-col gap-2">
            <p className="text-cap text-ink-3">Or try a demo pack</p>
            <div className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-md shadow-[inset_0_0_0_1px_var(--color-line)]">
              {DEMO_PACKS.map((p) => (
                <button key={p.id} type="button" onClick={() => onDemo(p.id)} className="h-11 px-1 text-foot font-medium text-ink hover:bg-fill">
                  {p.label}
                </button>
              ))}
            </div>
          </div>)}
          <DataFooter dataAsOf={meta?.dataAsOf} caveat={`${CAVEAT}. MedCheck never says a medicine is genuine or safe.`} className="mt-3" />
        </>
      }
    >
      <ResultPreview />
      <div className="flex flex-col gap-2 pt-2">
        <h1 className="text-display font-semibold">Check a medicine pack against NAFDAC records</h1>
        <p className="text-body text-ink-2">
          Take a photo of the pack. You confirm what we read, then we check it against the NAFDAC Greenbook and its falsified-medicine alerts.
        </p>
        <p className="text-foot text-ink-3">Have the pack in your hand. It takes about a minute.</p>
      </div>
    </Shell>
  );
}
