import { useEffect, useState } from 'react';
import { DEMO_PACKS, getMeta, USE_MOCKS, type DemoPackId, type Meta } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { CAVEAT } from '@shared/legend';
import { Button, Logo } from '@/components/ui';

export function Landing({ onStart, onManual, onDemo }: { onStart: () => void; onManual: () => void; onDemo: (id: DemoPackId) => void }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    getMeta().then(setMeta).catch(() => setMeta(null));
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-deep px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(18px,env(safe-area-inset-top))] text-paper">
      <Logo onDark />
      <div className="rise mt-14 grid gap-5">
        <div className="flex h-3 max-w-[220px] overflow-hidden rounded-full" aria-hidden="true">
          {['#F3F6F0', '#6E8649', '#477023', '#2D531A', '#0D330E'].map((c) => (
            <i key={c} className="flex-1" style={{ background: c }} />
          ))}
        </div>
        <h1 className="text-[46px] font-extrabold leading-[0.95] tracking-[-0.05em]" style={{ fontVariationSettings: '"opsz" 96' }}>
          Know what <span className="text-sprout">NAFDAC</span> says about your medicine.
        </h1>
        <p className="max-w-[34ch] text-[17px] text-on-deep-muted">
          Snap the pack. We read it, you confirm it, and we check it against NAFDAC's registry and falsified-medicine alerts.
        </p>
      </div>

      <div className="mt-auto grid gap-3 pt-10">
        <Button variant="light" onClick={onStart}>
          <span aria-hidden="true">📷</span> Check a medicine
        </Button>
        <button type="button" onClick={onManual} className="min-h-11 text-[15px] font-semibold text-sprout underline underline-offset-4">
          Type the details instead
        </button>

        <div className="mt-4 grid gap-2">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#9fb394]">Try a demo pack</p>
          <div className="flex flex-wrap gap-2">
            {DEMO_PACKS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onDemo(p.id)}
                className="min-h-10 rounded-full border border-moss px-3.5 text-[13px] font-semibold text-mist hover:border-sprout hover:bg-white/5"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <footer className="mt-4 grid gap-0.5 border-t border-moss pt-3 text-[12px] text-[#9fb394]">
          {meta && (
            <p className="tabular">
              Registry snapshot: {formatDate(meta.dataAsOf.registrySnapshot)} · Last NAFDAC alert: {formatDate(meta.dataAsOf.lastAlert)}
            </p>
          )}
          <p>
            {CAVEAT}. MedCheck never says a medicine is genuine or safe.{USE_MOCKS && ' · Demo data mode'}
          </p>
        </footer>
      </div>
    </div>
  );
}
