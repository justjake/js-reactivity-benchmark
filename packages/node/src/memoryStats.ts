/**
 * Per-test memory and GC statistics for a benchmark child process.
 *
 * FAIRNESS RULE: every memory number reported here is built from the triple
 * heapUsed + external + arrayBuffers, reported as components AND as their sum
 * ("total"), with RSS alongside as a cross-check. heapUsed alone is wrong in
 * both directions: a framework that stores its graph in ArrayBuffers (an
 * arena design) is invisible to heapUsed — its memory shows up in
 * external/arrayBuffers — while a framework that stores its graph as JS
 * objects is the inverse. The total is the only column where both designs
 * are comparable.
 *
 * Collection is split into two roles so memory numbers never perturb the
 * timing rows:
 *
 * - Timed runs (default): a PerformanceObserver({ entryTypes: ["gc"] })
 *   accumulates GC pause count + duration per kind, and a coarse unref'd
 *   interval samples process.memoryUsage() for peaks. Neither forces a
 *   collection and neither runs inside a timed region (the benches time
 *   synchronous bodies; observer/interval callbacks only run when the event
 *   loop turns between them), so pause stats describe real timed conditions.
 *
 * - Retained pass ("retained" mode, child spawned with --expose-gc): at
 *   every test boundary force a double GC and measure the surviving
 *   ("floor") total. floor minus the pre-suite baseline is the leak
 *   indicator: a leak-free suite shows a flat floorDelta; a monotonically
 *   climbing floor is a finding. --expose-gc also activates the benches'
 *   own gc() brackets, so timing columns from this pass are perturbed and
 *   the host discards them; only the floor columns are kept.
 *
 * Attribution: stats are deltas since the previous emitted row in this
 * process. Suite warmups run before the suite's first row, so their GC
 * activity is billed to that first row — acceptable because every framework
 * pays the same warmup structure.
 *
 * Known approximations (inherent to JS-level collection, documented rather
 * than hidden):
 * - GC observer entries are delivered when the event loop turns, so the
 *   memoryUsage() sample taken in the callback is post-GC, and for a fully
 *   synchronous test body it lands after the body. Peaks therefore track
 *   live-set highs (the retained graph), not transient garbage highs. The
 *   live set is exactly what distinguishes arena from object-graph designs.
 * - The interval sampler cannot fire inside a synchronous test body; it
 *   covers GC-quiet stretches between iterations and tests.
 * - Bun has no "gc" performance entry type: GC pause columns stay empty
 *   there, peaks/floors still work via process.memoryUsage(). Node is the
 *   supported runtime for the full column set.
 */
import {
  PerformanceObserver,
  constants as perfConstants,
} from "node:perf_hooks";

type Bytes = number;
type Milliseconds = number;

const BYTES_PER_MB = 1024 * 1024;
/** Coarse enough to be free, frequent enough to catch GC-quiet tests. */
const PEAK_SAMPLE_INTERVAL_MS = 75;
/** Double GC: the second pass collects weakly-held survivors of the first. */
const FORCED_GC_PASSES = 2;

/**
 * Columns appended after `framework , test , time`. Order is the wire
 * protocol between index.ts (child) and isolated.ts (host aggregator);
 * external consumers that only want timing keep reading the first three
 * columns and ignore the rest.
 */
export const MEMORY_COLUMNS = [
  "gcMinorN", //     scavenge count
  "gcMinorMs", //    scavenge total pause
  "gcMajorN", //     mark-compact count
  "gcMajorMs", //    mark-compact total pause
  "gcIncrN", //      incremental-marking step count
  "gcIncrMs", //     incremental-marking total duration
  "gcWeakN", //      weak-callback processing count
  "gcWeakMs", //     weak-callback total duration
  "peakHeapMb", //   max heapUsed
  "peakExtMb", //    max external
  "peakArrMb", //    max arrayBuffers
  "peakTotalMb", //  max (heapUsed + external + arrayBuffers) — the fair peak
  "peakRssMb", //    max RSS, cross-check only (includes code, stacks, allocator slack)
  "floorMb", //      retained pass: post-cleanup post-forced-GC total
  "floorDeltaMb", // retained pass: floorMb minus pre-suite baseline (leak indicator)
] as const;

export type MemoryColumn = (typeof MEMORY_COLUMNS)[number];
/** Formatted cell per column; "" = not collected in this mode/runtime. */
export type MemoryRow = Record<MemoryColumn, string>;

/** How to format (and re-format after host-side aggregation) each column. */
export const MEMORY_COLUMN_KIND: Record<MemoryColumn, "count" | "ms" | "mb"> = {
  gcMinorN: "count",
  gcMinorMs: "ms",
  gcMajorN: "count",
  gcMajorMs: "ms",
  gcIncrN: "count",
  gcIncrMs: "ms",
  gcWeakN: "count",
  gcWeakMs: "ms",
  peakHeapMb: "mb",
  peakExtMb: "mb",
  peakArrMb: "mb",
  peakTotalMb: "mb",
  peakRssMb: "mb",
  floorMb: "mb",
  floorDeltaMb: "mb",
};

export function formatMemoryValue(column: MemoryColumn, value: number): string {
  const kind = MEMORY_COLUMN_KIND[column];
  // Counts stay exact; medians of counts may land on .5 and print as such.
  if (kind === "count") return String(value);
  if (kind === "ms") return value.toFixed(1);
  return value.toFixed(2);
}

/** Widest column name; uniform width keeps rows grep- and eye-parseable. */
const MEMORY_COLUMN_WIDTH = Math.max(
  ...MEMORY_COLUMNS.map((name) => name.length),
);

export function emptyMemoryRow(): MemoryRow {
  const row = {} as MemoryRow;
  for (const column of MEMORY_COLUMNS) row[column] = "";
  return row;
}

export function memoryHeaderRow(): MemoryRow {
  const row = {} as MemoryRow;
  for (const column of MEMORY_COLUMNS) row[column] = column;
  return row;
}

/** Render the memory cells in wire order, same ` , ` separator as the base CSV. */
export function formatMemoryColumns(row: MemoryRow): string {
  return MEMORY_COLUMNS.map((column) =>
    (row[column] ?? "")
      .slice(0, MEMORY_COLUMN_WIDTH)
      .padEnd(MEMORY_COLUMN_WIDTH),
  ).join(" , ");
}

/** GC kind constant -> column pair. detail.kind carries these bit values. */
const GC_KIND_COLUMNS: [
  kind: number,
  countColumn: MemoryColumn,
  msColumn: MemoryColumn,
][] = [
  [perfConstants?.NODE_PERFORMANCE_GC_MINOR ?? 1, "gcMinorN", "gcMinorMs"],
  [perfConstants?.NODE_PERFORMANCE_GC_MAJOR ?? 4, "gcMajorN", "gcMajorMs"],
  [perfConstants?.NODE_PERFORMANCE_GC_INCREMENTAL ?? 8, "gcIncrN", "gcIncrMs"],
  [perfConstants?.NODE_PERFORMANCE_GC_WEAKCB ?? 16, "gcWeakN", "gcWeakMs"],
];

interface MemoryComponents {
  heapUsed: Bytes;
  external: Bytes;
  arrayBuffers: Bytes;
  rss: Bytes;
  /** heapUsed + external + arrayBuffers — the FAIRNESS RULE triple. */
  total: Bytes;
}

function readMemoryComponents(): MemoryComponents {
  const usage = process.memoryUsage();
  // Some runtimes (older Bun) omit arrayBuffers; treat absent as zero rather
  // than poisoning the total with NaN.
  const arrayBuffers = usage.arrayBuffers ?? 0;
  const external = usage.external ?? 0;
  return {
    heapUsed: usage.heapUsed,
    external,
    arrayBuffers,
    rss: usage.rss,
    total: usage.heapUsed + external + arrayBuffers,
  };
}

export interface MemoryStatsCollector {
  /** Stats since the previous flush; resets accumulators for the next test. */
  flushRow(): MemoryRow;
  /** Stop the observer and sampler so the process can exit promptly. */
  dispose(): void;
}

export type MemoryStatsMode = "timed" | "retained";

export function createMemoryStats(mode: MemoryStatsMode): MemoryStatsCollector {
  const gcCounts = new Map<MemoryColumn, number>();
  const gcDurations = new Map<MemoryColumn, Milliseconds>();
  let gcSupported = false;

  let peak: MemoryComponents = readMemoryComponents();

  function samplePeaks(): void {
    const now = readMemoryComponents();
    // Component maxima are tracked independently of the total's maximum:
    // max(total) is not sum(max(component)) when components peak at
    // different moments, and both views are reported.
    peak = {
      heapUsed: Math.max(peak.heapUsed, now.heapUsed),
      external: Math.max(peak.external, now.external),
      arrayBuffers: Math.max(peak.arrayBuffers, now.arrayBuffers),
      rss: Math.max(peak.rss, now.rss),
      total: Math.max(peak.total, now.total),
    };
  }

  function foldGcEntries(entries: PerformanceEntry[]): void {
    for (const entry of entries) {
      const detail = (entry as { detail?: { kind?: number } }).detail;
      const kind = detail?.kind;
      for (const [kindConstant, countColumn, msColumn] of GC_KIND_COLUMNS) {
        if (kind === kindConstant) {
          gcCounts.set(countColumn, (gcCounts.get(countColumn) ?? 0) + 1);
          gcDurations.set(
            msColumn,
            (gcDurations.get(msColumn) ?? 0) + entry.duration,
          );
        }
      }
    }
    // The heap sits near a local extreme around collections; cheap to fold in.
    if (entries.length > 0) samplePeaks();
  }

  let observer: PerformanceObserver | undefined;
  try {
    // Bun's PerformanceObserver exists but does not emit "gc" entries;
    // supportedEntryTypes is the documented feature probe (present at
    // runtime; @types/node omits the static, hence the shape cast).
    const supportedEntryTypes = (
      PerformanceObserver as { supportedEntryTypes?: readonly string[] }
    ).supportedEntryTypes;
    if (supportedEntryTypes?.includes("gc")) {
      observer = new PerformanceObserver((list) =>
        foldGcEntries(list.getEntries()),
      );
      observer.observe({ entryTypes: ["gc"] });
      gcSupported = true;
    }
  } catch {
    observer = undefined;
    gcSupported = false;
  }

  // unref() so a finished suite is never kept alive by the sampler; the
  // interval only exists to catch peaks in GC-quiet tests.
  const sampler = setInterval(samplePeaks, PEAK_SAMPLE_INTERVAL_MS);
  sampler.unref?.();

  const forceGc = globalThis.gc;
  if (mode === "retained" && forceGc === undefined) {
    console.error(
      "memoryStats: retained mode without --expose-gc; floor columns will be empty",
    );
  }

  function measureFloor(): MemoryComponents | undefined {
    if (forceGc === undefined) return undefined;
    for (let pass = 0; pass < FORCED_GC_PASSES; pass++) forceGc();
    return readMemoryComponents();
  }

  // The baseline is measured once, before any framework/suite work, so every
  // test's floorDelta shares the same zero point and a climb across tests
  // reads directly as retention.
  const baseline = mode === "retained" ? measureFloor() : undefined;

  function flushRow(): MemoryRow {
    // Attribute exactly up to this row: drain entries the observer callback
    // has not been scheduled for yet, then take a final peak sample.
    if (observer !== undefined) foldGcEntries(observer.takeRecords());
    samplePeaks();

    const row = emptyMemoryRow();
    if (gcSupported) {
      for (const [, countColumn, msColumn] of GC_KIND_COLUMNS) {
        row[countColumn] = formatMemoryValue(
          countColumn,
          gcCounts.get(countColumn) ?? 0,
        );
        row[msColumn] = formatMemoryValue(
          msColumn,
          gcDurations.get(msColumn) ?? 0,
        );
      }
    }
    row.peakHeapMb = formatMemoryValue(
      "peakHeapMb",
      peak.heapUsed / BYTES_PER_MB,
    );
    row.peakExtMb = formatMemoryValue(
      "peakExtMb",
      peak.external / BYTES_PER_MB,
    );
    row.peakArrMb = formatMemoryValue(
      "peakArrMb",
      peak.arrayBuffers / BYTES_PER_MB,
    );
    row.peakTotalMb = formatMemoryValue(
      "peakTotalMb",
      peak.total / BYTES_PER_MB,
    );
    row.peakRssMb = formatMemoryValue("peakRssMb", peak.rss / BYTES_PER_MB);

    if (mode === "retained" && baseline !== undefined) {
      const floor = measureFloor();
      if (floor !== undefined) {
        row.floorMb = formatMemoryValue("floorMb", floor.total / BYTES_PER_MB);
        row.floorDeltaMb = formatMemoryValue(
          "floorDeltaMb",
          (floor.total - baseline.total) / BYTES_PER_MB,
        );
      }
    }

    gcCounts.clear();
    gcDurations.clear();
    // Next interval's peaks start from the current (post-test, and in
    // retained mode post-forced-GC) state, not from this row's highs.
    peak = readMemoryComponents();
    return row;
  }

  return {
    flushRow,
    dispose(): void {
      observer?.disconnect();
      clearInterval(sampler);
    },
  };
}
