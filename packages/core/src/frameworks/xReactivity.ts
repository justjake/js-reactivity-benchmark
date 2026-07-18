import { ReactiveFramework } from "../util/reactiveFramework";
import {
  flush,
  createEffect,
  createMemo,
  createRoot,
  createSignal,
} from "@solidjs/signals";

// A cell is the framework's own accessor function. createSignal returns a
// [get, set] pair; the setter rides along as a property on the getter so
// the pair is not retained and every read stays a bare call.
type XReactivityCell = {
  (): unknown;
  set?: (v: unknown) => void;
};

export const xReactivityFramework: ReactiveFramework<XReactivityCell> = {
  name: "x-reactivity",
  createSignal: (initialValue) => {
    const [getter, setter] = createSignal(initialValue as any);
    const cell = getter as XReactivityCell;
    cell.set = setter as (v: unknown) => void;
    return cell;
  },
  readSignal: (s) => s(),
  writeSignal: (s, value) => {
    s.set!(value);
  },
  createComputed: (fn) => createMemo(fn),
  readComputed: (c) => c(),
  // @solidjs/signals' createEffect is natively a (compute, effect) pair; the
  // tracked shape passes the whole body as the compute with a no-op second
  // half, the pair shape passes both halves through.
  effect: (fn) => createEffect(fn, () => {}),
  effectPair: (compute, reaction) => createEffect(compute, reaction),
  withBatch: (fn) => {
    fn();
    flush();
  },
  withBuild: (fn) =>
    createRoot((dispose) => {
      xReactivityFramework.cleanup = dispose;
      return fn();
    }),
  cleanup: () => {},
};
