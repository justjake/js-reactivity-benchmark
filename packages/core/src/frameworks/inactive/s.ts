import { ReactiveFramework } from "../../util/reactiveFramework";
import S from "s-js";

// A cell is s-js's own data/computation callable: read via cell(), write
// via cell(v). No per-cell wrapper is needed.
type SCell = {
  (): unknown;
  (value: unknown): unknown;
};

export const sFramework: ReactiveFramework<SCell> = {
  name: "s-js",
  createSignal: (initialValue) => S.value(initialValue) as SCell,
  readSignal: (s) => s(),
  writeSignal: (s, value) => {
    s(value);
  },
  createComputed: (fn) => S(fn) as SCell,
  readComputed: (c) => c(),
  effect: (fn) => S(fn),
  withBatch: (fn) => S.freeze(fn),
  withBuild: (fn) =>
    S.root((dispose) => {
      sFramework.cleanup = dispose;
      return fn();
    }),
  cleanup: () => {},
};
