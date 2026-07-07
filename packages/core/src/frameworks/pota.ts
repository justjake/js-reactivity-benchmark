import { ReactiveFramework } from "../util/reactiveFramework";
import {
  batch,
  effect as createEffect,
  memo as createMemo,
  root as createRoot,
  signal as createSignal,
} from "pota";

// A cell is pota's own accessor function. signal() returns a [get, set]
// pair; the setter rides along as a property on the getter so the pair is
// not retained and every read stays a bare call.
type PotaCell = {
  (): unknown;
  set?: (v: unknown) => void;
};

export const potaFramework: ReactiveFramework<PotaCell> = {
  name: "Pota",
  createSignal: (initialValue) => {
    const [getter, setter] = createSignal(initialValue);
    const cell = getter as PotaCell;
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
      potaFramework.cleanup = dispose;
      return fn();
    }),
  cleanup: () => {},
};
