import { ReactiveFramework } from "../util/reactiveFramework";
// @ts-ignore
import * as $ from "svelte/internal/client";

// NOTE: The svelte adapter uses private, internal APIs that are usually only
// used by the Svelte compiler and client runtime. The Svelte team has made the
// decision to not expose these APIs publicly / officially, because it gives
// them more freedom to experiment without making breaking changes, but given
// that Svelte's v5 reactivity API is one of the most actively developed and
// efficient TS implementations available, I wanted to include it in the
// benchmark suite regardless.

// A cell is svelte's own internal source/derived object, read through $.get
// and written through $.set. The object is opaque to the benchmarks.
type SvelteCell = unknown;

export const svelteFramework: ReactiveFramework<SvelteCell> = {
  name: "Svelte v5",
  createSignal: (initialValue) => $.state(initialValue),
  readSignal: (s) => $.get(s),
  writeSignal: (s, value) => {
    $.set(s, value);
  },
  createComputed: (fn) => $.derived(fn),
  readComputed: (c) => $.get(c),
  effect: (fn) => {
    $.render_effect(fn);
  },
  withBatch: (fn) => $.flush(fn),
  withBuild: <T>(fn: () => T): T => {
    let res: T | undefined;
    svelteFramework.cleanup = $.effect_root(() => {
      res = fn();
    });
    return res!;
  },
  cleanup: () => {},
};
