import {
  batch,
  createAtom,
  createComputed,
  effect,
  effectScope,
  installState,
  type Atom,
  type Computed,
  type Signal,
} from "signals-royale-fx2";
import { ReactiveFramework } from "../util/reactiveFramework";

// signals-royale-fx2: the productionized Signals Royale champion (forkless
// concurrent React signals; two-tier watched/unwatched graph). Routed
// through the public Atom API. Graphs are built inside an effectScope and
// disposed in cleanup(), like the other adapters.
type Cell = Signal<unknown>;

let disposeScope: (() => void) | null = null;

export const royaleFx2Framework: ReactiveFramework<Cell> = {
  name: "Royale FX2",
  createSignal: (initialValue) => {
    const s = createAtom(initialValue);
    if (typeof initialValue === "function") {
      // The benchmark stores plain values; opt out of lazy-initializer
      // treatment for function-valued ones.
      installState(s, initialValue);
    }
    return s;
  },
  readSignal: (s) => (s as Atom<unknown>).get(),
  writeSignal: (s, value) => {
    (s as Atom<unknown>).set(value);
  },
  createComputed: (fn) => createComputed(fn),
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
