import { useEffect, useState } from 'react';
import { Camera, Keyboard } from 'lucide-react';
import { CAVEAT } from '@shared/legend';
import { DEMO_PACKS, getMeta, USE_MOCKS, type DemoPackId, type Meta } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataFooter, Shell } from '@/components/app-shell';

// A pack in the scan frame: the one picture that says what the app does.
function PackIllustration() {
  return (
    <svg viewBox="0 0 320 210" className="h-full w-full" role="img" aria-label="A medicine pack inside a scan frame">
      <g fill="none" stroke="#0A0C0A" strokeWidth="2.5" strokeLinecap="round">
        <path d="M44 34V20h14M276 34V20h-14M44 176v14h14M276 176v14h-14" />
      </g>
      <g transform="rotate(-4 160 105)">
        <rect x="74" y="44" width="172" height="122" rx="10" fill="#fff" stroke="#E7E8E5" />
        <rect x="74" y="44" width="172" height="30" rx="10" fill="#F5F5F3" />
        <rect x="74" y="64" width="172" height="10" fill="#F5F5F3" />
        <rect x="90" y="54" width="70" height="9" rx="4.5" fill="#0A0C0A" />
        <rect x="90" y="88" width="96" height="7" rx="3.5" fill="#52574F" />
        <rect x="90" y="102" width="62" height="7" rx="3.5" fill="#C9CBC6" />
        <rect x="88" y="122" width="104" height="22" rx="6" fill="none" stroke="#0D330E" strokeWidth="1.5" strokeDasharray="3 3" />
        <text x="96" y="137" fontFamily="Geist Variable, sans-serif" fontSize="10.5" fontWeight="600" fill="#0A0C0A">
          NAFDAC A4-6238
        </text>
        <g fill="#0A0C0A">
          {[0, 3, 5, 9, 11, 14, 18, 20, 23, 27].map((x, i) => (
            <rect key={x} x={204 + x} y="124" width={i % 3 === 0 ? 2 : 1.2} height="22" />
          ))}
        </g>
      </g>
    </svg>
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
      <div className="aspect-[320/210] w-full overflow-hidden rounded-lg bg-fill">
        <PackIllustration />
      </div>
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
