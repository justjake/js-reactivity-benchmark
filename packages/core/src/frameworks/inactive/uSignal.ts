import { ReactiveFramework } from "../../util/reactiveFramework";
import { batch, computed, effect, signal } from "usignal";

// A cell is usignal's own Signal instance; both signals and computeds read
// through .value. No per-cell wrapper is needed.
type USignalCell = {
  value: unknown;
};

let toCleanup: (() => void)[] = [];
export const usignalFramework: ReactiveFramework<USignalCell> = {
  name: "uSignal",
  createSignal: (initialValue) => signal(initialValue),
  readSignal: (s) => s.value,
  writeSignal: (s, value) => {
    s.value = value;
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
