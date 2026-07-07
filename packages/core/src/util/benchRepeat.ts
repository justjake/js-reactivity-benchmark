import { nextTick } from "./asyncUtil";
import { TimingResult } from "./perfTests";

/**
 * Benchmark a function n times and summarize with the MEDIAN run.
 *
 * This fork reports medians instead of upstream's fastest-of-n: the minimum
 * selects each framework's single luckiest lap, which systematically hides
 * costs that are amortized across runs (GC of the graph the run created,
 * deoptimization recovery, finalizer processing) and rewards best-case
 * latency. The median of independent runs is the standard robust summary
 * used by benchmark harnesses such as hyperfine, JMH steady-state runs, and
 * Criterion, and it is what we chart.
 *
 * Returns the run whose time is the median (odd n), or the faster of the two
 * middle runs with the interpolated median time (even n), so callers can
 * still verify that run's result values.
 */
export async function medianTest<T>(
  times: number,
  fn: () => T,
): Promise<TimingResult<T>> {
  const results: TimingResult<T>[] = [];
  for (let i = 0; i < times; i++) {
    await nextTick();
    const run = runTimed(fn);
    results.push(run);
  }
  const sorted = [...results].sort((a, b) => a.time - b.time);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  const lower = sorted[mid - 1];
  return { result: lower.result, time: (lower.time + sorted[mid].time) / 2 };
}

/** benchmark a function n times, returning the fastest result and associated timing */
export async function fastestTest<T>(
  times: number,
  fn: () => T,
): Promise<TimingResult<T>> {
  const results: TimingResult<T>[] = [];
  for (let i = 0; i < times; i++) {
    await nextTick();
    const run = runTimed(fn);
    results.push(run);
  }
  const fastest = results.reduce((a, b) => (a.time < b.time ? a : b));

  return fastest;
}

export interface TimedResult<T> {
  result: T;
  time: number;
}

/** run a function, recording how long it takes */
export function runTimed<T>(fn: () => T): TimedResult<T> {
  const start = performance.now();
  const result = fn();
  const time = performance.now() - start;
  return { result, time };
}
