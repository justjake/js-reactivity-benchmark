import { ReactiveFramework } from "../util/reactiveFramework";
// The package's `node` export condition resolves to a server build with
// inert reactivity, so load the browser build directly.
import {
  flush,
  createEffect,
  createMemo,
  createRoot,
  createSignal,
  createTrackedEffect,
} from "../../node_modules/solid-js-2/dist/solid.js";

// A cell is solid's own accessor function. createSignal returns a
// [get, set] pair; the setter rides along as a property on the getter so
// the pair is not retained and every read stays a bare call.
type Solid2Cell = {
  (): unknown;
  set?: (v: unknown) => void;
};

export const solid2Framework: ReactiveFramework<Solid2Cell> = {
  name: "SolidJS 2.0",
  createSignal: (initialValue) => {
    const [getter, setter] = createSignal(initialValue as any);
    const cell = getter as Solid2Cell;
    cell.set = setter as (v: unknown) => void;
    return cell;
  },
  readSignal: (s) => s(),
  writeSignal: (s, value) => {
    s.set!(value);
  },
  createComputed: (fn) => createMemo(fn),
  readComputed: (c) => c(),
  // Solid 2.0's createEffect is natively a (compute, effect) pair, and it
  // also ships createTrackedEffect, a leaf effect whose tracked function is
  // the side effect itself. Each style maps to its native API.
  effect: (fn) => {
    createTrackedEffect(fn);
  },
  effectPair: (compute, reaction) => createEffect(compute, reaction),
  withBatch: (fn) => {
    fn();
    flush();
  },
  withBuild: (fn: () => any) =>
    createRoot((dispose: () => void) => {
      solid2Framework.cleanup = dispose;
      return fn();
    }),
  cleanup: () => {},
};
