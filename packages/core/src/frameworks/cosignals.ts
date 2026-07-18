import {
  batch,
  createAtom,
  createComputed,
  createEffect,
  effectScope,
  type Atom,
  type Computed,
  type Signal,
} from "cosignals/core";
import { installState } from "cosignals/ssr";
import { ReactiveFramework } from "../util/reactiveFramework";

// Route through the public Atom API. Graphs are built inside an effectScope
// and disposed in cleanup(), like the other adapters.
type Cell = Signal<unknown>;

let disposeScope: (() => void) | null = null;

const NEVER_EQUAL = (): boolean => false;
const NOOP_HANDLER = (): void => {};

export const cosignalsFramework: ReactiveFramework<Cell> = {
  name: "Cosignals",
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
    // cosignals' effect is a pure tracked compute plus an untracked handler.
    // The benchmark's tracked effect is a single tracked body that reads and
    // counts but never writes signals, so it runs as the compute; never-equal
    // delivery keeps one handler run per re-run.
    createEffect(fn, NOOP_HANDLER, { equals: NEVER_EQUAL });
  },
  // The pair shape is this library's native effect: compute runs tracked,
  // the reaction handler runs untracked when compute's value changes under
  // the default equality.
  effectPair: (compute, reaction) => {
    createEffect(compute, reaction);
  },
  withBatch: (fn) => {
    batch(fn);
  },
  withBuild: <T>(fn: () => T): T => {
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
