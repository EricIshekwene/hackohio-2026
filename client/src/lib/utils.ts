import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Our type scale (text-display … text-cap) are font sizes, not colours; without this twMerge drops text-white next to text-body.
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ['display', 'title', 'body', 'foot', 'cap'] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
