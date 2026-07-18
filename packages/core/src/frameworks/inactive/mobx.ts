import { computed, observable, autorun, reaction, runInAction } from "mobx";
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
  // MobX's reaction() is natively a (compute, reaction) pair: the first
  // callback is tracked, the second runs untracked when the tracked value
  // changes under the default comparer.
  effectPair: (compute, reactionFn) =>
    toCleanup.push(reaction(compute, (value) => reactionFn(value))),
  withBatch: (fn) => runInAction(fn),
  withBuild: (fn) => fn(),
  cleanup: () => {
    for (const cleanup of toCleanup) {
      cleanup();
    }
    toCleanup = [];
  },
};
