import { ReactiveFramework } from "../util/reactiveFramework";
import {
  c,
  OPT_DEFER,
  root,
  signal,
  batch,
  Reader,
  Root,
  RootContext,
} from "anod";

// anod has no automatic dependency tracking: reads subscribe by calling
// c.val() on the context passed to each compute/effect callback. Track the
// innermost context here so cells can read through it.
let currentReader: Reader | null = null;
let currentRoot: RootContext | null = null;
let rootHandle: Root | null = null;

// A cell is anod's own signal or compute node; both read via .get() outside
// a tracking context and via reader.val() inside one. Signals carry .set().
type AnodCell = {
  get(): unknown;
  set?: (v: unknown) => void;
};

function tracked<T>(fn: () => T): (c: Reader) => T {
  return (c) => {
    const prev = currentReader;
    currentReader = c;
    try {
      return fn();
    } finally {
      currentReader = prev;
    }
  };
}

function readCell(cell: AnodCell): unknown {
  return currentReader ? currentReader.val(cell) : cell.get();
}

export const anodFramework: ReactiveFramework<AnodCell> = {
  name: "anod",
  createSignal: (initialValue) => signal(initialValue),
  readSignal: readCell,
  writeSignal: (s, value) => {
    s.set!(value);
  },
  createComputed: (fn) =>
    (currentRoot ?? c).compute(tracked(fn), undefined, OPT_DEFER),
  readComputed: readCell,
  effect: (fn) => (currentRoot ?? c).effect(tracked(fn)),
  withBatch: (fn) => batch(fn),
  withBuild: <T>(fn: () => T) => {
    let out!: T;
    rootHandle = root((c) => {
      currentRoot = c;
      out = fn();
    });
    return out;
  },
  cleanup: () => {
    rootHandle?.dispose();
    rootHandle = null;
    currentRoot = null;
  },
};
