import { ReactiveFramework } from "../util/reactiveFramework";
import {
  batch,
  computed,
  effect,
  signal,
  type ReadonlySignal,
  type Signal,
} from "@preact/signals";

// A cell is preact's own Signal instance; both signals and computeds read
// through .value. No per-cell wrapper is needed.
type PreactCell = ReadonlySignal<unknown>;

let toCleanup: (() => void)[] = [];
export const preactSignalFramework: ReactiveFramework<PreactCell> = {
  name: "Preact Signals",
  createSignal: (initialValue) => signal(initialValue),
  readSignal: (s) => s.value,
  writeSignal: (s, value) => {
    (s as Signal<unknown>).value = value;
  },
  createComputed: (fn) => computed(fn),
  readComputed: (c) => c.value,
  effect: (fn) => toCleanup.push(effect(fn)),
  withBatch: (fn) => batch(fn),
  withBuild: (fn) => fn(),
  cleanup: () => {
    for (const cleanup of toCleanup) {
      cleanup();
    }
    toCleanup = [];
  },
};
