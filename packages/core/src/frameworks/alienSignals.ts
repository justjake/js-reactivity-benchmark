import {
  computed,
  effect,
  endBatch,
  signal,
  startBatch,
  effectScope,
} from "alien-signals/esm";
import { ReactiveFramework } from "../util/reactiveFramework";

// A cell is alien-signals' own callable: signals read via s() and write via
// s(v); computeds read via c(). No per-cell wrapper is needed.
type AlienCell = {
  (): unknown;
  (value: unknown): void;
};

let scope: (() => void) | null = null;

export const alienFramework: ReactiveFramework<AlienCell> = {
  name: "Alien Signals",
  createSignal: (initialValue) => signal(initialValue) as AlienCell,
  readSignal: (s) => s(),
  writeSignal: (s, value) => {
    s(value);
  },
  createComputed: (fn) => computed(fn) as AlienCell,
  readComputed: (c) => c(),
  // alien-signals >= 3.2 treats a non-undefined return value from the effect
  // callback as a cleanup function; the bench contract guarantees fn returns
  // undefined, so fn passes through without a protective wrapper.
  effect: (fn) => {
    effect(fn);
  },
  withBatch: (fn) => {
    startBatch();
    fn();
    endBatch();
  },
  withBuild: <T>(fn: () => T) => {
    let out!: T;
    scope = effectScope(() => {
      out = fn();
    });
    return out;
  },
  cleanup: () => {
    scope!();
    scope = null;
  },
};
