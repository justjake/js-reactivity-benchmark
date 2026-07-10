import { batch, computed, effect, effectScope, Signal, type Computed } from "signals-royale-fx2";
import { ReactiveFramework } from "../util/reactiveFramework";

// signals-royale-fx2: the productionized Signals Royale champion (forkless
// concurrent React signals; two-tier watched/unwatched graph). Routed
// through the public class API. Graphs are built inside an effectScope and
// disposed in cleanup(), like the other adapters.
type Cell = Signal<unknown> | Computed<unknown>;

let disposeScope: (() => void) | null = null;

export const royaleFx2Framework: ReactiveFramework<Cell> = {
  name: "Royale FX2",
  createSignal: (initialValue) => {
    const s = new Signal(initialValue, undefined);
    if (typeof initialValue === "function") {
      // The benchmark stores plain values; opt out of lazy-initializer
      // treatment for function-valued ones.
      s.node.initializer = undefined;
      s.node.value = initialValue;
    }
    return s;
  },
  readSignal: (s) => (s as Signal<unknown>).get(),
  writeSignal: (s, value) => {
    (s as Signal<unknown>).set(value);
  },
  createComputed: (fn) => computed(fn),
  readComputed: (cell) => (cell as Computed<unknown>).get(),
  effect: (fn) => {
    effect(fn);
  },
  withBatch: (fn) => {
    batch(fn);
  },
  withBuild: <T,>(fn: () => T): T => {
    let out!: T;
    disposeScope = effectScope(() => {
      out = fn();
    });
    return out;
  },
  cleanup: () => {
    disposeScope?.();
    disposeScope = null;
  },
};
