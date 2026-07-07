import {
  computed,
  effect,
  EffectScope,
  effectScope,
  ReactiveEffect,
  shallowRef,
} from "@vue/reactivity";
import { ReactiveFramework } from "../../util/reactiveFramework";

// A cell is vue's own ref or computed ref; both read through .value.
// No per-cell wrapper is needed.
type VueCell = {
  value: unknown;
};

let scheduled = [] as ReactiveEffect[];
let scope: EffectScope | null = null;
export const vueReactivityFramework: ReactiveFramework<VueCell> = {
  name: "Vue",
  createSignal: (initialValue) => shallowRef(initialValue),
  readSignal: (s) => s.value,
  writeSignal: (s, value) => {
    s.value = value;
  },
  createComputed: (fn) => computed(fn),
  readComputed: (c) => c.value,
  effect: (fn) => {
    let t = effect(fn, {
      scheduler: () => {
        scheduled.push(t.effect);
      },
    });
  },
  withBatch: (fn) => {
    fn();
    flushEffects();
  },
  withBuild: (fn) => {
    scope = effectScope();
    return scope.run(fn)!;
  },
  cleanup: () => {
    scope!.stop();
    scope = null;
  },
};

function flushEffects() {
  while (scheduled.length) {
    scheduled.pop()!.run();
  }
}
