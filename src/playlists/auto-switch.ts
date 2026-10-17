export function advanceAutoSwitchCountdown(
  remainingMs: number,
  elapsedMs: number,
  hasSignal: boolean,
): number {
  if (!hasSignal) return Math.max(0, remainingMs);
  return Math.max(0, remainingMs - Math.max(0, elapsedMs));
}
