import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'light' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-moss disabled:bg-[#c7d2c0] disabled:text-white',
  secondary: 'bg-white text-ink border border-line hover:border-moss',
  light: 'bg-paper text-deep hover:bg-white',
  ghost: 'bg-transparent text-moss hover:bg-mist',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] px-4 text-[15px] font-semibold transition-colors duration-150 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-card border border-line bg-white p-4 ${className}`}>{children}</div>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">{children}</h2>;
}

export function Logo({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 text-[17px] font-extrabold tracking-[-0.02em] ${onDark ? 'text-paper' : 'text-ink'}`}>
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill={onDark ? '#6E8649' : '#0D330E'} />
        <rect x="13" y="7" width="6" height="18" rx="1.5" fill="#F3F6F0" />
        <rect x="7" y="13" width="18" height="6" rx="1.5" fill="#F3F6F0" />
      </svg>
      MedCheck
    </span>
  );
}
