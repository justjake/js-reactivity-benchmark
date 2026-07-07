import {
  flushEffects,
  setEffectMode,
  effect,
  effectScope,
  computed,
  signal,
  type EffectStop,
} from "dalien-signals";
import { ReactiveFramework } from "../util/reactiveFramework";

// dalien-signals through its DEFAULT API: upstream-shaped
// callables (sig() reads, sig(next) writes) that are their own GC owners —
// drop the callable, the record reclaims — the leak-free basic interface,
// measured as-is, at the library's default capacity (the suite never grows
// the arena).
setEffectMode("manual");

// A cell is the library's own callable; no per-cell wrapper is needed.
type DalienCell = {
  (): unknown;
  (value: unknown): void;
};

let scope: EffectStop | null = null;

export const dalienFramework: ReactiveFramework<DalienCell> = {
  name: "Dalien Signals",
  createSignal: (initialValue) => signal(initialValue) as DalienCell,
  readSignal: (s) => s(),
  writeSignal: (s, value) => {
    s(value);
  },
  createComputed: (fn) => computed(fn) as DalienCell,
  readComputed: (c) => c(),
  // alien-signals >= 3.2 treats a non-undefined return value from the effect
  // callback as a cleanup function; the bench contract guarantees fn returns
  // undefined, so fn passes through without a protective wrapper.
  effect: (fn) => {
    effect(fn);
  },
  withBatch: (fn) => {
    fn();
    flushEffects();
  },
  withBuild: <T>(fn: () => T) => {
    let out!: T;
    scope = effectScope(() => {
      out = fn();
    });
    return out;
  },
  cleanup: () => {
    if (scope !== null) {
      scope();
      scope = null;
    }
  },
};
