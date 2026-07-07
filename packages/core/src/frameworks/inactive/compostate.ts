import { signal, computed, syncEffect, batch, createRoot } from "compostate";
import { ReactiveFramework } from "../../util/reactiveFramework";

// A cell is compostate's own getter function. signal() returns a [get, set]
// pair; the setter rides along as a property on the getter so the pair is
// not retained and every read stays a bare call.
type CompostateCell = {
  (): unknown;
  set?: (v: unknown) => void;
};

let toCleanup: (() => void)[] = [];
export const compostateFramework: ReactiveFramework<CompostateCell> = {
  name: "Compostate",
  createSignal: (initialValue) => {
    const [get, set] = signal(initialValue);
    const cell = get as CompostateCell;
    cell.set = set as (v: unknown) => void;
    return cell;
  },
  readSignal: (s) => s(),
  writeSignal: (s, value) => {
    s.set!(value);
  },
  createComputed: (fn) => computed(fn),
  readComputed: (c) => c(),
  effect: (fn) => toCleanup.push(syncEffect(fn)),
  withBatch: (fn) => batch(fn),
  withBuild: (fn) => createRoot(fn),
  cleanup: () => {
    for (const cleanup of toCleanup) {
      cleanup();
    }
    toCleanup = [];
  },
};
