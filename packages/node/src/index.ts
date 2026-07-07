import {
  frameworkInfo,
  formatPerfResult,
  PerfResult,
  perfResultHeaders,
  runTests,
} from "js-reactivity-benchmark/src/index";

function logLine(line: string): void {
  console.log(line);
}

function logPerfResult(result: PerfResult): void {
  logLine(
    formatPerfResult({
      framework: result.framework,
      test: result.test,
      time: result.time.toFixed(2),
    }),
  );
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
  const requested = args;
  const selected =
    requested.length > 0
      ? frameworkInfo.filter((f) => requested.includes(f.framework.name))
      : frameworkInfo;
  logLine(formatPerfResult(perfResultHeaders()));
  await runTests(selected, (result) => {
    if (testFilter === undefined || result.test.includes(testFilter)) {
      logPerfResult(result);
    }
  });
}

main();
