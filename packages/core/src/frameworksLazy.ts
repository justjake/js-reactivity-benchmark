import type { FrameworkInfo } from "./util/frameworkTypes";

/**
 * Lazy counterpart of frameworksList's frameworkInfo, for runners that
 * benchmark one framework per process.
 *
 * Importing an adapter module can execute library code with import-time side
 * effects: several of the arena-based libraries here allocate their typed
 * array storage the moment their module evaluates (measured: cosignals
 * ~240 MB, dalien-signals ~128 MB of external/ArrayBuffer memory). A child
 * process that measures memory must only pay for the framework it actually
 * benchmarks, so this registry defers each adapter's import until load()
 * is called.
 *
 * Names are duplicated as string literals ON PURPOSE — reading them from the
 * adapter would require importing it. frameworks.test.ts asserts every
 * literal matches the loaded adapter's own name, so the copies can't drift.
 *
 * The eager frameworkInfo list stays as-is for the browser runner and the
 * example site, which want every framework loaded up front.
 */
export interface LazyFrameworkInfo {
  name: string;
  load: () => Promise<FrameworkInfo>;
}

export const lazyFrameworkInfo: LazyFrameworkInfo[] = [
  {
    name: "Alien Signals",
    load: async () => ({
      framework: (await import("./frameworks/alienSignals")).alienFramework,
      testPullCounts: true,
    }),
  },
  {
    name: "Dalien Signals",
    load: async () => ({
      framework: (await import("./frameworks/dalienSignals")).dalienFramework,
      testPullCounts: true,
    }),
  },
  {
    name: "Dalien Malloc Free",
    load: async () => ({
      framework: (await import("./frameworks/dalienMallocFree"))
        .dalienMallocFreeFramework,
      testPullCounts: true,
    }),
  },
  {
    name: "Cosignal",
    load: async () => ({
      framework: (await import("./frameworks/cosignal")).cosignalFramework,
      testPullCounts: true,
    }),
  },
  {
    name: "Cosignal Alt A",
    load: async () => ({
      framework: (await import("./frameworks/cosignalAltA"))
        .cosignalAltAFramework,
      testPullCounts: true,
    }),
  },
  {
    name: "Cosignal Alt B",
    load: async () => ({
      framework: (await import("./frameworks/cosignalAltB"))
        .cosignalAltBFramework,
      testPullCounts: true,
    }),
  },
  {
    name: "Royale FX2",
    load: async () => ({
      framework: (await import("./frameworks/royaleFx2")).royaleFx2Framework,
      testPullCounts: true,
    }),
  },
  {
    name: "Angular Signals",
    load: async () => ({
      framework: (await import("./frameworks/angularSignals2"))
        .angularFramework,
      testPullCounts: true,
    }),
  },
  {
    name: "Compostate",
    load: async () => ({
      framework: (await import("./frameworks/inactive/compostate"))
        .compostateFramework,
      testPullCounts: true,
    }),
  },
  {
    name: "MobX",
    load: async () => ({
      framework: (await import("./frameworks/inactive/mobx")).mobxFramework,
      testPullCounts: true,
    }),
  },
  {
    name: "Preact Signals",
    load: async () => ({
      framework: (await import("./frameworks/preactSignals"))
        .preactSignalFramework,
      testPullCounts: true,
    }),
  },
  {
    name: "Reactively",
    load: async () => ({
      framework: (await import("./frameworks/reactively")).reactivelyFramework,
      testPullCounts: true,
    }),
  },
  {
    name: "s-js",
    load: async () => ({
      framework: (await import("./frameworks/inactive/s")).sFramework,
    }),
  },
  {
    // solid can't testPullCounts because batch executes all leaf nodes even
    // if unread
    name: "SolidJS",
    load: async () => ({
      framework: (await import("./frameworks/solid")).solidFramework,
    }),
  },
  {
    name: "Pota",
    load: async () => ({
      framework: (await import("./frameworks/pota")).potaFramework,
    }),
  },
  {
    name: "Svelte v5",
    load: async () => ({
      framework: (await import("./frameworks/svelte")).svelteFramework,
      testPullCounts: true,
    }),
  },
  {
    name: "amadeus-it-group/tansu",
    load: async () => ({
      framework: (await import("./frameworks/tansu")).tansuFramework,
      testPullCounts: true,
    }),
  },
  {
    name: "TanStack Store",
    load: async () => ({
      framework: (await import("./frameworks/tanstackStore"))
        .tanstackStoreFramework,
      testPullCounts: true,
    }),
  },
  {
    name: "Vue",
    load: async () => ({
      framework: (await import("./frameworks/inactive/vueReactivity"))
        .vueReactivityFramework,
      testPullCounts: true,
    }),
  },
  {
    name: "x-reactivity",
    load: async () => ({
      framework: (await import("./frameworks/xReactivity"))
        .xReactivityFramework,
      testPullCounts: true,
    }),
  },
];
