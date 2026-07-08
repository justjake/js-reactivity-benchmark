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
 * Usage: node dist/isolated.js [--rounds N] [frameworkName...]
 */
import {
  frameworkInfo,
  formatPerfResult,
  perfResultHeaders,
} from "js-reactivity-benchmark/src/index";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

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

const requested = argv;
const names = frameworkInfo.map((f) => f.framework.name);
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

// (framework, test) -> per-round times; test order preserved per framework.
const samples = new Map<string, Map<string, number[]>>();
for (const name of selected) samples.set(name, new Map());
let failures = 0;

for (let round = 0; round < rounds; round++) {
  for (const name of selected) {
    console.error(`round ${round + 1}/${rounds}: ${name}`);
    // No --expose-gc, matching upstream's node runner: forced double-majors
    // between tests are untimed but evict every framework's working set, so
    // the following timed regions start cache-cold — measured to distort
    // comparisons more than the cross-suite GC billing it removes.
    const result = spawnSync(process.execPath, [indexJs, name], {
      stdio: ["ignore", "pipe", "inherit"],
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
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
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 3 || parts[0] !== name) continue;
      const time = Number(parts[2]);
      if (!Number.isFinite(time)) continue;
      let arr = perTest.get(parts[1]);
      if (arr === undefined) {
        arr = [];
        perTest.set(parts[1], arr);
      }
      arr.push(time);
    }
  }
}

console.log(formatPerfResult(perfResultHeaders()));
for (const name of selected) {
  const perTest = samples.get(name)!;
  for (const [test, times] of perTest) {
    if (times.length < rounds) {
      console.error(
        `⚠ ${name} / ${test}: only ${times.length}/${rounds} rounds completed`,
      );
    }
    console.log(
      formatPerfResult({
        framework: name,
        test,
        time: medianOf(times).toFixed(2),
      }),
    );
  }
}
process.exit(failures > 0 && samples.size === 0 ? 1 : 0);
