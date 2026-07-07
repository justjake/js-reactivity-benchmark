import { ReactiveFramework } from "../util/reactiveFramework";
import { writable, computed, batch } from "@amadeus-it-group/tansu";

// A cell is tansu's own store callable; writable stores carry .set.
type TansuCell = {
  (): unknown;
  set?: (v: unknown) => void;
};

let toCleanup: (() => void)[] = [];
export const tansuFramework: ReactiveFramework<TansuCell> = {
  name: "amadeus-it-group/tansu",
  createSignal: (initialValue) => writable(initialValue) as TansuCell,
  readSignal: (s) => s(),
  writeSignal: (s, value) => {
    s.set!(value);
  },
  createComputed: (fn) => computed(fn) as TansuCell,
  readComputed: (c) => c(),
  effect: (fn) => toCleanup.push(computed(fn).subscribe(() => {})),
  withBatch: (fn) => batch(fn),
  withBuild: (fn) => fn(),
  cleanup: () => {
    for (const cleanup of toCleanup) {
      cleanup();
    }
    toCleanup = [];
  },
};
