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
} from "signals-royale-fx2-dalien";
import { ReactiveFramework } from "../util/reactiveFramework";

type Cell = Signal<unknown>;

let disposeScope: (() => void) | null = null;

export const royaleFx2DalienFramework: ReactiveFramework<Cell> = {
  name: "Royale FX2 Dalien",
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
    // Scope disposal reclaims synchronously (records return to free stacks;
    // cell records detach at last unlink), so no arena wipe is needed between
    // cases — matching the object-graph adapter, whose cleanup is disposal
    // alone.
    disposeScope?.();
    disposeScope = null;
  },
};
