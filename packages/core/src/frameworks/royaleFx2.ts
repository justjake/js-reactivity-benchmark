import {
  batch,
  createAtom,
  createComputed,
  effect,
  effectScope,
  type Atom,
  type Computed,
  type Signal,
} from "signals-royale-fx2";
import { installState } from "signals-royale-fx2/ssr";
import { ReactiveFramework } from "../util/reactiveFramework";

// signals-royale-fx2: the productionized Signals Royale champion (forkless
// concurrent React signals; two-tier watched/unwatched graph). Routed
// through the public Atom API. Graphs are built inside an effectScope and
// disposed in cleanup(), like the other adapters.
type Cell = Signal<unknown>;

let disposeScope: (() => void) | null = null;

const NEVER_EQUAL = (): boolean => false;
const NOOP_HANDLER = (): void => {};

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
    // fx2's effect is a pure tracked compute plus an untracked handler. The
    // benchmark's effect is a single tracked body that reads and counts but
    // never writes signals, so it runs as the compute; never-equal delivery
    // keeps one handler run per re-run.
    effect(fn, NOOP_HANDLER, { equals: NEVER_EQUAL });
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
