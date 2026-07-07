import * as lib from "cosignal";
import { ReactiveFramework } from "../util/reactiveFramework";

// cosignal v1 DIRECT build, routed through the public class API (Atom /
// Computed `.state` and `.set`) so the benchmark measures the surface
// applications use, policy wrapper included. Graphs are built inside an
// effectScope and disposed in cleanup(), like the other adapters.
// A cell is the Atom or Computed instance itself; both expose .state.
type CosignalCell = lib.Atom<unknown> | lib.Computed<unknown>;

let scope: (() => void) | null = null;

export const cosignalFramework: ReactiveFramework<CosignalCell> = {
  name: "Cosignal",
  createSignal: (initialValue) => new lib.Atom(initialValue),
  readSignal: (cell) => cell.state,
  writeSignal: (cell, value) => {
    (cell as lib.Atom<unknown>).set(value);
  },
  createComputed: (fn) => new lib.Computed(fn),
  readComputed: (cell) => cell.state,
  // The bench contract guarantees fn returns undefined, so returns are never
  // treated as cleanup functions and fn passes through unwrapped.
  effect: (fn) => {
    lib.effect(fn);
  },
  withBatch: (fn) => {
    lib.startBatch();
    fn();
    lib.endBatch();
  },
  withBuild: <T>(fn: () => T) => {
    let out!: T;
    scope = lib.effectScope(() => {
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
