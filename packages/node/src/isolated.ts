/**
 * Runs the benchmark suite with each framework in its own node process, so
 * that one framework's JIT warmup, GC pressure, and polymorphic call sites
 * can't affect another framework's numbers.
 *
 * Frameworks are run in ROUNDS, round-robin (A B C, A B C, ...), and each
 * test's final time is the MEDIAN of its per-round times. Interleaving
 * decorrelates slow machine drift (thermals, background load) from any one
 * framework, and the median discards lucky/unlucky rounds; a single
 * sequential pass can move a framework's totals by ~10% on a laptop, which
 * is larger than many of the gaps being measured.
 *
 * Memory columns (see memoryStats.ts for the fairness rule and column
 * semantics) ride along in two ways:
 * - GC pause counts/durations and peak sizes come from the SAME timed runs
 *   (a passive observer + coarse sampler in the child), so they describe
 *   real conditions; medians are taken across rounds like the times.
 * - Retained "floor" columns come from one extra --memory pass per framework
 *   with --expose-gc and forced-GC brackets at test boundaries. That pass's
 *   timing is perturbed by design, so only its floor columns are kept.
 *
 * Usage: node dist/isolated.js [--rounds N] [--memory] [--no-memory]
 *                              [--deep-memory] [frameworkName...]
 *   --memory      add the retained/floor pass (fills floorMb/floorDeltaMb)
 *   --no-memory   legacy 3-column CSV; also the timing-perturbation A/B knob
 *   --deep-memory bisect the minimum --max-old-space-size per framework on a
 *                 representative creation-heavy suite (see caveat at the flag)
 */
// Imported from the individual source modules, not the index: the index
// pulls the eager frameworksList, and several adapter imports allocate
// arena memory at module load. The host never benchmarks anything itself,
// but staying lazy here keeps its footprint small and its startup honest.
import {
  formatPerfResult,
  perfResultHeaders,
} from "js-reactivity-benchmark/src/util/perfLogging";
import { lazyFrameworkInfo } from "js-reactivity-benchmark/src/frameworksLazy";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  emptyMemoryRow,
  formatMemoryColumns,
  formatMemoryValue,
  memoryHeaderRow,
  MEMORY_COLUMNS,
  MemoryColumn,
  MemoryRow,
} from "./memoryStats";

const indexJs = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "index.js",
);

const argv = process.argv.slice(2);
let rounds = 3;
const roundsAt = argv.indexOf("--rounds");
if (roundsAt !== -1) {
  rounds = Number(argv[roundsAt + 1]);
  if (!Number.isInteger(rounds) || rounds < 1) {
    console.error(`--rounds expects a positive integer`);
    process.exit(1);
  }
  argv.splice(roundsAt, 2);
}
const takeFlag = (name: string): boolean => {
  const at = argv.indexOf(name);
  if (at === -1) return false;
  argv.splice(at, 1);
  return true;
};
const retainedPassWanted = takeFlag("--memory");
const memoryDisabled = takeFlag("--no-memory");
const deepMemoryWanted = takeFlag("--deep-memory");
if (memoryDisabled && (retainedPassWanted || deepMemoryWanted)) {
  console.error(`--no-memory contradicts --memory/--deep-memory`);
  process.exit(1);
}

const requested = argv;
const names = lazyFrameworkInfo.map((f) => f.name);
const unknown = requested.filter((name) => !names.includes(name));
if (unknown.length > 0) {
  console.error(
    `unknown frameworks: ${unknown.join(", ")}; available: ${names.join(", ")}`,
  );
  process.exit(1);
}
const selected = requested.length > 0 ? requested : names;

function medianOf(times: number[]): number {
  const sorted = [...times].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface TestSamples {
  times: number[];
  /** column -> per-round values; a column absent in a round contributes nothing. */
  memory: Map<MemoryColumn, number[]>;
}

// (framework, test) -> per-round samples; test order preserved per framework.
const samples = new Map<string, Map<string, TestSamples>>();
for (const name of selected) samples.set(name, new Map());
// (framework, test) -> floor columns from the retained pass.
const floors = new Map<
  string,
  Map<string, Pick<MemoryRow, "floorMb" | "floorDeltaMb">>
>();
let failures = 0;

const FRAMEWORK_COLUMN = 0;
const TEST_COLUMN = 1;
const TIME_COLUMN = 2;
const FIRST_MEMORY_COLUMN = 3;

/** Split a child CSV line; undefined for headers/noise/other frameworks. */
function parseChildRow(
  line: string,
  name: string,
):
  | { test: string; time: number; memory: Map<MemoryColumn, number> }
  | undefined {
  const parts = line.split(",").map((p) => p.trim());
  if (parts.length < 3 || parts[FRAMEWORK_COLUMN] !== name) return undefined;
  const time = Number(parts[TIME_COLUMN]);
  if (!Number.isFinite(time)) return undefined;
  const memory = new Map<MemoryColumn, number>();
  // Positional wire protocol shared with index.ts via MEMORY_COLUMNS; empty
  // cells mean "not collected in this mode/runtime" and stay absent.
  for (let i = 0; i < MEMORY_COLUMNS.length; i++) {
    const cell = parts[FIRST_MEMORY_COLUMN + i];
    if (cell === undefined || cell === "") continue;
    const value = Number(cell);
    if (Number.isFinite(value)) memory.set(MEMORY_COLUMNS[i], value);
  }
  return { test: parts[TEST_COLUMN], time, memory };
}

function spawnChild(
  nodeArgs: string[],
  childArgs: string[],
  env?: NodeJS.ProcessEnv,
) {
  return spawnSync(process.execPath, [...nodeArgs, indexJs, ...childArgs], {
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: env ?? process.env,
  });
}

// --- Timed rounds -----------------------------------------------------------
for (let round = 0; round < rounds; round++) {
  for (const name of selected) {
    console.error(`round ${round + 1}/${rounds}: ${name}`);
    // No --expose-gc, matching upstream's node runner: forced double-majors
    // between tests are untimed but evict every framework's working set, so
    // the following timed regions start cache-cold — measured to distort
    // comparisons more than the cross-suite GC billing it removes.
    // (Retained/floor numbers, which DO need forced GC, come from the
    // separate --memory pass below so this pass stays undisturbed.)
    const result = spawnChild(
      [],
      [name],
      memoryDisabled ? { ...process.env, MEMORY_STATS: "off" } : undefined,
    );
    if (result.status !== 0) {
      failures++;
      console.error(
        `⚠ ${name} round ${round + 1} exited with ${
          result.status !== null ? `code ${result.status}` : result.signal
        } (keeping rows from its other rounds)`,
      );
    }
    const perTest = samples.get(name)!;
    for (const line of (result.stdout ?? "").split("\n")) {
      const row = parseChildRow(line, name);
      if (row === undefined) continue;
      let entry = perTest.get(row.test);
      if (entry === undefined) {
        entry = { times: [], memory: new Map() };
        perTest.set(row.test, entry);
      }
      entry.times.push(row.time);
      for (const [column, value] of row.memory) {
        let values = entry.memory.get(column);
        if (values === undefined) {
          values = [];
          entry.memory.set(column, values);
        }
        values.push(value);
      }
    }
  }
}

// --- Retained/floor pass (--memory) -----------------------------------------
// One pass per framework, after all timed rounds so it cannot share a machine
// moment with them. --expose-gc both enables the collector's forced-GC
// brackets and activates the benches' own gc() calls; timing from this pass
// is therefore meaningless and discarded — only floor columns are kept.
if (retainedPassWanted) {
  for (const name of selected) {
    console.error(`retained pass: ${name}`);
    const result = spawnChild(["--expose-gc"], ["--retained", name]);
    if (result.status !== 0) {
      console.error(
        `⚠ ${name} retained pass exited with ${
          result.status !== null ? `code ${result.status}` : result.signal
        } (floor columns left empty)`,
      );
      continue;
    }
    const perTest = new Map<
      string,
      Pick<MemoryRow, "floorMb" | "floorDeltaMb">
    >();
    for (const line of (result.stdout ?? "").split("\n")) {
      const row = parseChildRow(line, name);
      if (row === undefined) continue;
      const floorMb = row.memory.get("floorMb");
      const floorDeltaMb = row.memory.get("floorDeltaMb");
      if (floorMb === undefined || floorDeltaMb === undefined) continue;
      perTest.set(row.test, {
        floorMb: formatMemoryValue("floorMb", floorMb),
        floorDeltaMb: formatMemoryValue("floorDeltaMb", floorDeltaMb),
      });
    }
    floors.set(name, perTest);
  }
}

// --- Final CSV ---------------------------------------------------------------
const baseHeader = formatPerfResult(perfResultHeaders());
console.log(
  memoryDisabled
    ? baseHeader
    : `${baseHeader} , ${formatMemoryColumns(memoryHeaderRow())}`,
);
for (const name of selected) {
  const perTest = samples.get(name)!;
  const perTestFloors = floors.get(name);
  for (const [test, entry] of perTest) {
    if (entry.times.length < rounds) {
      console.error(
        `⚠ ${name} / ${test}: only ${entry.times.length}/${rounds} rounds completed`,
      );
    }
    const base = formatPerfResult({
      framework: name,
      test,
      time: medianOf(entry.times).toFixed(2),
    });
    if (memoryDisabled) {
      console.log(base);
      continue;
    }
    // Median across rounds for observer stats (gc counts/pauses, peaks) —
    // same robustness argument as the times. Floors come from the single
    // retained pass, so they pass through unaggregated.
    const memory = emptyMemoryRow();
    for (const [column, values] of entry.memory) {
      memory[column] = formatMemoryValue(column, medianOf(values));
    }
    const floor = perTestFloors?.get(test);
    if (floor !== undefined) {
      memory.floorMb = floor.floorMb;
      memory.floorDeltaMb = floor.floorDeltaMb;
    }
    console.log(`${base} , ${formatMemoryColumns(memory)}`);
  }
}

// --- Deep mode (--deep-memory): minimum old-space cap by bisection -----------
// Bisects the smallest --max-old-space-size at which one representative
// creation-heavy suite (cellx: thousands of computeds+effects per graph)
// completes. CAVEAT, and the reason this is opt-in rather than the headline:
// the old-space cap governs the V8 JS heap only — ArrayBuffer backing stores
// live outside it — so this UNDER-measures arena designs that keep their
// graph in typed arrays. The fair headline is peakTotalMb above.
const DEEP_SUITE = "cellx";
const DEEP_CAP_START_MB = 16; //     below Node's practical minimum; first probe
const DEEP_CAP_CEILING_MB = 4096; // give up above this: something else is wrong
const DEEP_CAP_GRANULARITY_MB = 8;
const DEEP_CHILD_TIMEOUT_MS = 300_000; // near-OOM GC thrash counts as failure

function deepPassSucceeds(name: string, capMb: number): boolean {
  const result = spawnSync(
    process.execPath,
    [`--max-old-space-size=${capMb}`, indexJs, name],
    {
      stdio: ["ignore", "ignore", "ignore"],
      env: { ...process.env, SUITES: DEEP_SUITE, MEMORY_STATS: "off" },
      timeout: DEEP_CHILD_TIMEOUT_MS,
    },
  );
  return result.status === 0;
}

if (deepMemoryWanted) {
  const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
  if (isBun) {
    console.error("deep-memory: skipped under Bun (no --max-old-space-size)");
  } else {
    for (const name of selected) {
      let hi = DEEP_CAP_START_MB;
      let lo = 0;
      while (!deepPassSucceeds(name, hi)) {
        lo = hi;
        hi *= 2;
        if (hi > DEEP_CAP_CEILING_MB) break;
      }
      if (hi > DEEP_CAP_CEILING_MB) {
        console.error(
          `deep-memory: ${name} failed even at ${DEEP_CAP_CEILING_MB}MB`,
        );
        continue;
      }
      while (hi - lo > DEEP_CAP_GRANULARITY_MB) {
        const mid = Math.floor((lo + hi) / 2);
        if (deepPassSucceeds(name, mid)) hi = mid;
        else lo = mid;
      }
      console.error(
        `deep-memory: ${name} minimum old-space cap ~${hi}MB (${DEEP_SUITE})`,
      );
      // Four fields on purpose: every CSV consumer here keys on 3-field rows
      // (or on the framework column), so this line is ignorable noise to them.
      console.log(`# deepMemory , ${name} , minOldSpaceMb , ${hi}`);
    }
  }
}

process.exit(failures > 0 && samples.size === 0 ? 1 : 0);
