import type { FrameworkInfo } from "./util/frameworkTypes";

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
// runTests lives in its own module so process-per-framework runners can
// import it without evaluating frameworksList (whose adapter imports run
// library code that allocates arenas at module load); importing THIS module
// still pulls the full list, matching its historical behavior.
export { runTests } from "./runTests";
export { lazyFrameworkInfo, type LazyFrameworkInfo } from "./frameworksLazy";
