import { Reactive, stabilize } from "@reactively/core";
import { ReactiveFramework } from "../util/reactiveFramework";

// A cell is a Reactive node itself; signals and computeds both read via
// .get(). No per-cell wrapper is needed.
type ReactivelyCell = Reactive<unknown>;

// @reactively/core has no public disposal API, and its effects re-run on
// every stabilize() for as long as their sources still list them as
// observers — without teardown, each benchmark round's effects keep firing
// against dead graphs. Detach an effect by hand; this relies on
// runtime-accessible TS-private fields of Reactive.
function disposeEffect(effectNode: ReactivelyCell): void {
  // Reactive's fields are TS-private but plain at runtime; cast once.
  const node = effectNode as any;
  // run pending user cleanups exactly as update() would
  if (node.cleanups.length) {
    for (const c of node.cleanups) c(node._value);
    node.cleanups = [];
  }
  node.removeParentObservers(0); // detach from every source's observer list
  node.sources = null;
  node.effect = false; // never re-enters the effect queue
  node.state = 0; // CacheClean: a stale effect-queue entry no-ops on get()
}

let effects: ReactivelyCell[] = [];

export const reactivelyFramework: ReactiveFramework<ReactivelyCell> = {
  name: "Reactively",
  createSignal: (initialValue) => new Reactive(initialValue),
  readSignal: (s) => s.get(),
  writeSignal: (s, value) => s.set(value),
  createComputed: (fn) => new Reactive(fn),
  readComputed: (c) => c.get(),
  effect: (fn) => {
    effects.push(new Reactive<unknown>(fn, true));
  },
  withBatch: (fn) => {
    fn();
    stabilize();
  },
  withBuild: (fn) => fn(),
  cleanup: () => {
    const disposing = effects;
    effects = [];
    for (const node of disposing) {
      disposeEffect(node);
    }
  },
};
