import { cn } from '@/lib/utils';

// The only place the brand green is a fill: a capsule mark on a Pakistan Green tile.
export function Logo({ className, onStage = false }: { className?: string; onStage?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]', onStage ? 'text-white' : 'text-ink', className)}>
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <rect width="24" height="24" rx="7" fill="#0D330E" />
        <g transform="rotate(-45 12 12)">
          <rect x="5" y="9" width="14" height="6" rx="3" fill="none" stroke="#fff" strokeWidth="1.6" />
          <path d="M12 9.8v4.4" stroke="#fff" strokeWidth="1.6" />
          <path d="M8 9.8h4v4.4H8a2.2 2.2 0 0 1 0-4.4Z" fill="#fff" />
        </g>
      </svg>
      MedCheck
    </span>
  );
}
