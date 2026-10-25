import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-[6px] px-1.5 text-[11px] font-medium leading-none', {
  variants: {
    variant: {
      default: 'bg-fill text-ink-2',
      outline: 'text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)]',
      warn: 'bg-[#FDE7B0] text-[#92400E]',
    },
  },
  defaultVariants: { variant: 'default' },
});

function Badge({ className, variant, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
