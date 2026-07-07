/**
 * Median of a list of timings (interpolated for even counts). See
 * benchRepeat.ts for why this fork summarizes with medians rather than
 * upstream's fastest-of-n.
 */
export function medianOf(times: number[]): number {
  const sorted = [...times].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
