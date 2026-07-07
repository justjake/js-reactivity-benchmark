import { ReactiveFramework } from "../util/reactiveFramework";
import { Signal } from "signal-polyfill";

// A cell is the polyfill's own State or Computed instance; both read via
// .get(). No per-cell wrapper is needed.
type Tc39Cell = Signal.State<unknown> | Signal.Computed<unknown>;

let toCleanup: (() => void)[] = [];
export const tc39SignalsFramework: ReactiveFramework<Tc39Cell> = {
  name: "TC39 Signals",
  createSignal: (initialValue) => new Signal.State(initialValue),
  readSignal: (s) => s.get(),
  writeSignal: (s, value) => {
    (s as Signal.State<unknown>).set(value);
  },
  createComputed: (fn) => new Signal.Computed(fn),
  readComputed: (c) => c.get(),
  effect: (callback) => {
    const computed = new Signal.Computed(() => callback());

    w.watch(computed);
    computed.get();

    toCleanup.push(() => w.unwatch(computed));
  },
  withBatch: (fn) => {
    fn();
    processPending();
  },
  withBuild: (fn) => fn(),
  cleanup: () => {
    for (const cleanup of toCleanup) {
      cleanup();
    }
    toCleanup = [];
  },
};

let needsEnqueue = false;

const w = new Signal.subtle.Watcher(() => {
  if (needsEnqueue) {
    needsEnqueue = false;
  }
});

function processPending() {
  needsEnqueue = true;

  for (const s of w.getPending()) {
    s.get();
  }

  w.watch();
}
