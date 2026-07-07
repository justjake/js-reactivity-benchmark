import { ReactiveFramework } from "../util/reactiveFramework";
import $ from "mol_wire_lib";

const Atom = $.$mol_wire_atom; // fix a bug in mol exports

// A cell is a $mol_wire_atom instance; both signals and computeds read via
// .sync() and atoms accept writes via .put(). No per-cell wrapper is needed.
type MolWireCell = {
  put(v: unknown): unknown;
  sync(): unknown;
};

let toCleanup: $.$mol_wire_atom<unknown, [], unknown>[] = [];
export const molWireFramework: ReactiveFramework<MolWireCell> = {
  name: "$mol_wire_atom",
  createSignal: (initialValue) =>
    new Atom("", (next: unknown = initialValue) => next),
  readSignal: (s) => s.sync(),
  writeSignal: (s, value) => {
    s.put(value);
  },
  createComputed: (fn) => new Atom("", fn),
  readComputed: (c) => c.sync(),
  effect: (fn) => toCleanup.push(new Atom("", fn)),
  withBatch: (fn) => {
    fn();
    Atom.sync();
  },
  withBuild: (fn) => fn(),
  cleanup: () => {
    for (const cleanup of toCleanup) {
      cleanup.destructor();
    }
    toCleanup = [];
  },
};
