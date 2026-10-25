import { Input as InputPrimitive } from '@base-ui/react/input';
import { cn } from '@/lib/utils';

function Input({ className, ...props }: InputPrimitive.Props) {
  return (
    <InputPrimitive
      data-slot="input"
      className={cn(
        'h-12 w-full min-w-0 rounded-md bg-surface px-3.5 text-[16px] text-ink shadow-[inset_0_0_0_1px_var(--color-line)] outline-none transition-shadow placeholder:text-ink-3 focus:shadow-[inset_0_0_0_1.5px_var(--color-ink)] disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
