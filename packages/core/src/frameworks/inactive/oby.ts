import { ReactiveFramework } from "../../util/reactiveFramework";
import $ from "oby";

// A cell is oby's own observable callable: read via cell(), write via
// cell(v). No per-cell wrapper is needed.
type ObyCell = {
  (): unknown;
  (value: unknown): unknown;
};

export const obyFramework: ReactiveFramework<ObyCell> = {
  name: "Oby",
  createSignal: (initialValue) => $(initialValue) as ObyCell,
  readSignal: (s) => s(),
  writeSignal: (s, value) => {
    s(value);
  },
  createComputed: (fn) => $.memo(fn) as ObyCell,
  readComputed: (c) => c(),
  effect: (fn) => $.effect(fn),
  withBatch: (fn) => {
    fn();
    $.tick();
  },
  withBuild: (fn) =>
    $.root((dispose) => {
      obyFramework.cleanup = dispose;
      return fn();
    }),
  cleanup: () => {},
};
