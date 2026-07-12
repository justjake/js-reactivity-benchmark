import {
  batch,
  computed,
  effect,
  effectScope,
  resetGraphForBenchmark,
  Signal,
  type Computed,
} from "signals-royale-fx2-dalien";
import { ReactiveFramework } from "../util/reactiveFramework";

type Cell = Signal<unknown> | Computed<unknown>;

let disposeScope: (() => void) | null = null;

export const royaleFx2DalienFramework: ReactiveFramework<Cell> = {
  name: "Royale FX2 Dalien",
  createSignal: (initialValue) => {
    const s = new Signal(initialValue, undefined);
    if (typeof initialValue === "function") {
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
    // Scope disposal reclaims synchronously (records return to free stacks;
    // cell records detach at last unlink), so no arena wipe is needed between
    // cases — matching the object-graph adapter, whose cleanup is disposal
    // alone.
    disposeScope?.();
    disposeScope = null;
  },
};
