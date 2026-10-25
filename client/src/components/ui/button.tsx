import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium tracking-[-0.005em] transition-[background-color,color,box-shadow,opacity] outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none data-[disabled]:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-[18px]',
  {
    variants: {
      variant: {
        default: 'bg-ink text-white hover:bg-ink/88 active:bg-ink/80 disabled:bg-[#d9dad7] disabled:text-white',
        secondary: 'bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-fill active:bg-[#ededea]',
        ghost: 'text-ink hover:bg-fill',
        link: 'h-auto px-0 text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink',
        onStage: 'bg-white/12 text-white backdrop-blur hover:bg-white/18',
      },
      size: {
        default: 'h-12 px-5 text-body',
        sm: 'h-9 rounded-sm px-3 text-foot',
        icon: 'size-10 rounded-full',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function Button({ className, variant, size, block, ...props }: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return <ButtonPrimitive data-slot="button" className={cn(buttonVariants({ variant, size, block, className }))} {...props} />;
}

export { Button, buttonVariants };
