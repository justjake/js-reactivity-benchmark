// Benchmark child process: one invocation benchmarks the requested
// framework(s) and writes CSV rows to stdout.
//
// Imports deliberately avoid js-reactivity-benchmark's index module: index
// re-exports the eager frameworksList, whose adapter imports run library
// code that allocates arenas at module load. This child measures memory per
// framework, so it resolves adapters through the lazy registry and only
// evaluates the ones it was asked to benchmark.
import {
  formatPerfResult,
  PerfResult,
  perfResultHeaders,
} from "js-reactivity-benchmark/src/util/perfLogging";
import { runTests } from "js-reactivity-benchmark/src/runTests";
import { lazyFrameworkInfo } from "js-reactivity-benchmark/src/frameworksLazy";
import {
  createMemoryStats,
  formatMemoryColumns,
  memoryHeaderRow,
  MemoryStatsCollector,
} from "./memoryStats";

function logLine(line: string): void {
  console.log(line);
}

async function main() {
  const args = process.argv.slice(2);
  const testFilterIdx = args.indexOf("--test");
  let testFilter: string | undefined;
  if (testFilterIdx !== -1) {
    testFilter = args[testFilterIdx + 1];
    args.splice(testFilterIdx, 2);
  }
  if (testFilter !== undefined) {
    process.env.TEST_FILTER = testFilter;
  }

  // --retained marks the gc-bracketed floor pass (the isolated host spawns
  // it with --expose-gc); MEMORY_STATS=off restores the exact
  // pre-memory-columns output, used for the timing-perturbation A/B and by
  // anything that wants the legacy 3-column CSV.
  const retainedIdx = args.indexOf("--retained");
  const retained = retainedIdx !== -1;
  if (retained) args.splice(retainedIdx, 1);
  const memoryEnabled = process.env.MEMORY_STATS !== "off";

  const requested = args;
  const selectedLazy =
    requested.length > 0
      ? lazyFrameworkInfo.filter((f) => requested.includes(f.name))
      : lazyFrameworkInfo;
  // Adapters evaluate here, before the collector exists, so a benchmarked
  // framework's own import-time arena is part of its baseline rather than
  // billed as the first test's allocation spike.
  const selected = await Promise.all(selectedLazy.map((f) => f.load()));

  const collector: MemoryStatsCollector | undefined = memoryEnabled
    ? createMemoryStats(retained ? "retained" : "timed")
    : undefined;

  function logPerfResult(result: PerfResult): void {
    // Flush per result even when the row is filtered from output, so the
    // "since previous row" attribution windows stay one test wide.
    const memory = collector?.flushRow();
    if (testFilter !== undefined && !result.test.includes(testFilter)) return;
    const base = formatPerfResult({
      framework: result.framework,
      test: result.test,
      time: result.time.toFixed(2),
    });
    logLine(
      memory === undefined ? base : `${base} , ${formatMemoryColumns(memory)}`,
    );
  }

  const header = formatPerfResult(perfResultHeaders());
  logLine(
    collector === undefined
      ? header
      : `${header} , ${formatMemoryColumns(memoryHeaderRow())}`,
  );
  await runTests(selected, logPerfResult);
  collector?.dispose();
}

main();
