import { ReactiveFramework } from "../util/reactiveFramework";
import { atom, computed, react, transact } from "@tldraw/state";

// A cell is tldraw's own atom or computed instance; both read via .get()
// and atoms carry .set(). No per-cell wrapper is needed.
type TldrawCell = {
  get(): unknown;
  set?: (v: unknown) => void;
};

let toCleanup: (() => void)[] = [];
export const tldrawStateFramework: ReactiveFramework<TldrawCell> = {
  name: "@tldraw/state",
  createSignal: (initialValue) => atom("s", initialValue),
  readSignal: (s) => s.get(),
  writeSignal: (s, value) => {
    s.set!(value);
  },
  createComputed: (fn) => computed("c", fn),
  readComputed: (c) => c.get(),
  effect: (fn) => toCleanup.push(react("e", fn)),
  withBatch: (fn) => transact(fn),
  withBuild: (fn) => fn(),
  cleanup: () => {
    for (const cleanup of toCleanup) {
      cleanup();
    }
    toCleanup = [];
  },
};
