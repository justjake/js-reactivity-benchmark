import {
  flushEffects,
  setEffectMode,
  computedId,
  dispose,
  effectId,
  effectScopeId,
  get,
  set,
  signalId,
  type SignalId,
} from "dalien-signals";
import { ReactiveFramework } from "../util/reactiveFramework";

// The userspace branch through its RAW ID TIER: signalId()/computedId()
// return bare numeric record ids with NO GC ownership — no handle objects,
// no FinalizationRegistry, nothing for the collector to trace. Lifetime is
// 100% explicit: every id created here lives until the enclosing effect
// scope is disposed (creations inside a scope region are freed with it).
// This is the malloc/free counterpart to the "Dalien Signals" adapter,
// isolating what the leak-free-by-default interface costs. With S = the
// numeric id itself, this adapter allocates nothing per cell. Library
// default capacity; the suite never grows the arena.
setEffectMode("manual");

let scope: SignalId | null = null;

export const dalienMallocFreeFramework: ReactiveFramework<SignalId> = {
  name: "Dalien Malloc Free",
  createSignal: (initialValue) => signalId(initialValue),
  readSignal: (id) => get(id),
  writeSignal: (id, value) => set(id, value),
  createComputed: (fn) => computedId(fn),
  readComputed: (id) => get(id),
  // alien-signals >= 3.2 treats a non-undefined return value from the effect
  // callback as a cleanup function; the bench contract guarantees fn returns
  // undefined, so fn passes through without a protective wrapper.
  effect: (fn) => {
    effectId(fn);
  },
  withBatch: (fn) => {
    fn();
    flushEffects();
  },
  withBuild: <T>(fn: () => T) => {
    let out!: T;
    scope = effectScopeId(() => {
      out = fn();
    });
    return out;
  },
  cleanup: () => {
    if (scope !== null) {
      dispose(scope);
      scope = null;
    }
  },
};
