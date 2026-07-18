import { makeGraph, runGraph } from "./dependencyGraph";
import { verifyBenchResult } from "../../util/perfTests";
import { stylesFor, styledTestName } from "../../util/effectStyle";
import { FrameworkInfo, TestConfig } from "../../util/frameworkTypes";
import { perfTests } from "../../config";
import { medianTest } from "../../util/benchRepeat";
import { PerfResultCallback } from "../../util/perfLogging";
import { nextTick } from "../../util/asyncUtil";

function percent(n: number): string {
  return Math.round(n * 100) + "%";
}

export function makeTitle(config: TestConfig): string {
  const { width, totalLayers, staticFraction, nSources, readFraction } = config;
  const dyn = staticFraction < 1 ? " - dyn" + percent(1 - staticFraction) : "";
  const read = readFraction < 1 ? ` - lazy${percent(1 - readFraction)}` : "";
  return `${nSources}-${width}x${totalLayers}${dyn}${read}`;
}

/** benchmark a single test under single framework.
 * The test is run multiple times and the median result is logged to the console.
 */
export async function dynamicBench(
  frameworkInfo: FrameworkInfo[],
  logPerfResult: PerfResultCallback,
  testRepeats = 5,
): Promise<void> {
  for (const config of perfTests) {
    for (const frameworkTest of frameworkInfo) {
      const { framework } = frameworkTest;
      for (const style of stylesFor(framework)) {
        const { iterations, readFraction } = config;

        const { graph, counter } = makeGraph(
          framework,
          readFraction,
          config,
          style,
        );

        function runOnce(): number {
          return runGraph(graph, iterations, framework);
        }

        // warm up
        runOnce();
        runOnce();

        await nextTick();
        runOnce();

        const timedResult = await medianTest(testRepeats, () => {
          counter.count = 0;
          const sum = runOnce();
          return { sum, count: counter.count };
        });

        framework.cleanup();
        if (globalThis.gc) (gc!(), gc!());

        logPerfResult({
          framework: framework.name,
          test: styledTestName(
            makeTitle(config) + (config.name ? ` (${config.name})` : ""),
            style,
          ),
          time: timedResult.time,
        });
        verifyBenchResult(frameworkTest, config, timedResult);
      }
    }
  }
}
