import * as lib from "cosignals-alt-b";
import { ReactiveFramework } from "../util/reactiveFramework";

// cosignals-alt-b, routed through its public class API (Atom / Computed
// `.state` and `.set`, options-object constructors) so the benchmark
// measures the surface applications use, policy wrapper included. A cell is
// the Atom or Computed instance itself; both expose .state. Graphs are
// built inside an effectScope and disposed in cleanup(), like the other
// adapters.
type AltBCell = lib.Atom<unknown> | lib.Computed<unknown>;

// The engine's typed-array planes regrow only at operation boundaries
// (never inside an open effectScope), and the benches build whole graphs
// inside one withBuild scope. Pre-size the module-singleton engine once at
// load, before any node exists. 2^21 records = a 64 MiB Int32Array main
// plane: the suite's largest single-operation create shape (sbench
// create1to1: 1e5 signals + 1e5 computeds + their links) stays near 300k
// records, and the dalien-signals example field builds ~1.2M records in
// one scope at 320p. Larger field tiers exceed what an import-time
// pre-size should pin and fail at build with the engine's own "raise
// initialRecords" error.
lib.__resetEngineForTests({ initialRecords: 1 << 21 });

let scope: (() => void) | null = null;

export const cosignalAltBFramework: ReactiveFramework<AltBCell> = {
  name: "Cosignal Alt B",
  createSignal: (initialValue) => new lib.Atom({ state: initialValue }),
  readSignal: (cell) => cell.state,
  writeSignal: (cell, value) => {
    (cell as lib.Atom<unknown>).set(value);
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
