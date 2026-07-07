import { computed, observable, autorun, runInAction } from "mobx";
import { ReactiveFramework } from "../../util/reactiveFramework";

// A cell is mobx's own box or computed value; both read via .get() and
// boxes carry .set(). No per-cell wrapper is needed.
type MobxCell = {
  get(): unknown;
  set?: (v: unknown) => void;
};

let toCleanup: (() => void)[] = [];
export const mobxFramework: ReactiveFramework<MobxCell> = {
  name: "MobX",
  createSignal: (initialValue) => observable.box(initialValue, { deep: false }),
  readSignal: (s) => s.get(),
  writeSignal: (s, value) => {
    s.set!(value);
  },
  createComputed: (fn) => computed(fn),
  readComputed: (c) => c.get(),
  effect: (fn) => toCleanup.push(autorun(fn)),
  withBatch: (fn) => runInAction(fn),
  withBuild: (fn) => fn(),
  cleanup: () => {
    for (const cleanup of toCleanup) {
      cleanup();
    }
    toCleanup = [];
  },
};
