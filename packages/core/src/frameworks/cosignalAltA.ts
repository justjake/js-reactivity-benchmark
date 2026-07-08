import * as lib from "cosignals-alt-a";
import { ReactiveFramework } from "../util/reactiveFramework";

// cosignals-alt-a, routed through its public class API (Atom / Computed
// `.state` and `.set`, options-object constructors) so the benchmark
// measures the surface applications use, policy wrapper included. The
// classes come from an API factory bound to the package's module-singleton
// engine, so instance types are named via InstanceType rather than exported
// type names. A cell is the Atom or Computed instance itself; both expose
// .state. Graphs are built inside an effectScope and disposed in cleanup(),
// like the other adapters.
type AltAAtom = InstanceType<typeof lib.Atom<unknown>>;
type AltACell = AltAAtom | InstanceType<typeof lib.Computed<unknown>>;

let scope: (() => void) | null = null;

export const cosignalAltAFramework: ReactiveFramework<AltACell> = {
  name: "Cosignal Alt A",
  createSignal: (initialValue) => new lib.Atom({ state: initialValue }),
  readSignal: (cell) => cell.state,
  writeSignal: (cell, value) => {
    (cell as AltAAtom).set(value);
  },
  createComputed: (fn) => new lib.Computed({ fn }),
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
