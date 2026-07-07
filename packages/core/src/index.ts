import { dynamicBench } from "./benches/reactively/dynamicBench";
import { cellxbench } from "./benches/cellxBench";
import { sbench } from "./benches/sBench";
import { kairoBench } from "./benches/kairoBench";
import { promiseDelay } from "./util/asyncUtil";
import type { FrameworkInfo } from "./util/frameworkTypes";
import { PerfResultCallback } from "./util/perfLogging";

export type { ReactiveFramework } from "./util/reactiveFramework";
export {
  perfResultHeaders,
  formatPerfResult,
  type PerfResult,
  type PerfResultStrings,
  type PerfResultCallback,
} from "./util/perfLogging";
export { frameworkInfo, allFrameworks } from ".//frameworksList";
export type { FrameworkInfo };

export async function runTests(
  frameworkInfo: FrameworkInfo[],
  logPerfResult: PerfResultCallback,
) {
  // Optional suite filter for debugging/bisection, e.g. SUITES=kairo,dynamic.
  // Applies identically to every framework; timing methodology is unchanged.
  const suites = process.env.SUITES?.split(",");
  const want = (name: string) => !suites || suites.includes(name);
  await promiseDelay(0);

  if (want("sbench")) {
    for (const { framework } of frameworkInfo) {
      await sbench(framework, logPerfResult);
      await promiseDelay(1000);
    }
  }

  if (want("kairo")) {
    await kairoBench(frameworkInfo, logPerfResult);
  }

  if (want("cellx")) {
    await cellxbench(frameworkInfo, logPerfResult);
    await promiseDelay(1000);
  }

  if (want("dynamic")) {
    await dynamicBench(frameworkInfo, logPerfResult);
    await promiseDelay(1000);
  }
}
