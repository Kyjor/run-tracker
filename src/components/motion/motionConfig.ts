/** Shared spring / duration tokens for framer-motion */
export const springSnappy = { type: 'spring' as const, stiffness: 400, damping: 30 };
export const springSoft = { type: 'spring' as const, stiffness: 300, damping: 28 };
export const fadeTransition = { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const };

export function useReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
