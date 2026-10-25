// Pure timing helpers. No Playwright here, so they are unit-tested.

// Frame i lasts step(i) ms, so frames land on whole milliseconds and never drift (33/34/33 at 30 fps).
export function frameStep(i: number, fps: number): number {
  return Math.round(((i + 1) * 1000) / fps) - Math.round((i * 1000) / fps);
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOut = (t: number) => 1 - (1 - t) ** 3;

// Human-ish but deterministic typing: a fixed rhythm from the character itself, slower after spaces.
export function typingDelay(ch: string, i: number): number {
  const base = 70 + ((ch.charCodeAt(0) * 7 + i * 13) % 45);
  return ch === ' ' || ch === '-' ? base + 60 : base;
}

// Tap ripple: grows and fades over `durationMs`.
export function ripple(elapsedMs: number, durationMs = 420): { radius: number; opacity: number } | null {
  if (elapsedMs < 0 || elapsedMs > durationMs) return null;
  const t = elapsedMs / durationMs;
  return { radius: 10 + 26 * easeOut(t), opacity: 0.32 * (1 - t) };
}
