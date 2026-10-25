import type { ReactNode } from 'react';
import { Logo } from './ui';

const STEPS = ['Snap', 'Read', 'Confirm', 'Result'] as const;

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-start" aria-label="Progress">
      {STEPS.map((label, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li key={label} className="flex flex-1 items-start last:flex-none">
            <div className="flex w-12 flex-col items-center gap-1" aria-current={on ? 'step' : undefined}>
              <span
                className={`grid size-6 place-items-center rounded-full border text-[11px] font-bold transition-colors ${
                  on ? 'border-paper bg-paper text-deep' : done ? 'border-fern bg-fern text-white' : 'border-white/35 text-[#d7e3ce]'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <span className={`text-[11px] ${on ? 'font-semibold text-white' : 'text-[#9fb394]'}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <span className={`mt-3 h-px flex-1 ${done ? 'bg-fern' : 'bg-white/25'}`} />}
          </li>
        );
      })}
    </ol>
  );
}

// One 430 px column. The dark band carries the brand, the stepper and the screen title.
export function Shell({
  step,
  title,
  subtitle,
  onBack,
  children,
  footer,
}: {
  step?: number;
  title?: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-paper">
      <header className="rounded-b-[24px] bg-deep px-4 pb-5 pt-[max(14px,env(safe-area-inset-top))] text-paper">
        <div className="flex h-10 items-center justify-between">
          {onBack ? (
            <button type="button" onClick={onBack} className="-ml-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-[15px] font-semibold text-sprout">
              <span aria-hidden="true">←</span> Back
            </button>
          ) : (
            <Logo onDark />
          )}
          {onBack && <Logo onDark />}
        </div>
        {step !== undefined && (
          <div className="mt-4">
            <Stepper current={step} />
          </div>
        )}
        {title && (
          <div className="mt-5 grid gap-1.5">
            <h1 className="text-[28px] font-extrabold leading-[1.02] tracking-[-0.035em]">{title}</h1>
            {subtitle && <p className="text-[15px] text-on-deep-muted">{subtitle}</p>}
          </div>
        )}
      </header>
      <main className="rise flex flex-1 flex-col gap-4 px-4 pb-6 pt-5">{children}</main>
      {footer && (
        <div className="sticky bottom-0 z-10 grid gap-2 border-t border-line bg-paper/95 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          {footer}
        </div>
      )}
    </div>
  );
}
