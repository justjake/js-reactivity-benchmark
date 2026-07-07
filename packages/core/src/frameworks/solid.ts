import { ReactiveFramework } from "../util/reactiveFramework";
import {
  batch,
  createEffect,
  createMemo,
  createRoot,
  createSignal,
} from "solid-js/dist/solid.cjs";

// A cell is solid's own accessor function. createSignal returns a
// [get, set] pair; the setter rides along as a property on the getter so
// the pair is not retained and every read stays a bare call.
type SolidCell = {
  (): unknown;
  set?: (v: unknown) => void;
};

export const solidFramework: ReactiveFramework<SolidCell> = {
  name: "SolidJS",
  createSignal: (initialValue) => {
    const [getter, setter] = createSignal(initialValue);
    const cell = getter as SolidCell;
    cell.set = setter as (v: unknown) => void;
    return cell;
  },
  readSignal: (s) => s(),
  writeSignal: (s, value) => {
    s.set!(value);
  },
  createComputed: (fn) => createMemo(fn),
  readComputed: (c) => c(),
  effect: (fn) => createEffect(fn),
  withBatch: (fn) => batch(fn),
  withBuild: (fn) =>
    createRoot((dispose) => {
      solidFramework.cleanup = dispose;
      return fn();
    }),
  cleanup: () => {},
};
