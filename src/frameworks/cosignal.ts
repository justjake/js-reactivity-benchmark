import { ReactiveFramework } from "../util/reactiveFramework";
import {
  Atom,
  Computed,
  effect,
  batch,
} from "../../../../packages/cosignal/src/core/index.ts";
import {
  setWriteBatchProvider,
  isForked,
} from "../../../../packages/cosignal/src/core/engine.ts";

function makeFramework(name: string): ReactiveFramework {
  return {
    name,
    signal: (initialValue) => {
      const a = new Atom({ state: initialValue });
      return {
        read: () => a.state,
        write: (v) => {
          a.set(v);
        },
      };
    },
    computed: (fn) => {
      const c = new Computed({ fn });
      return { read: () => c.state };
    },
    effect: (fn) => {
      effect(fn);
    },
    withBatch: (fn) => {
      batch(fn);
    },
    withBuild: (fn) => fn(),
  };
}

export const cosignalFramework = makeFramework("cosignal");

/**
 * Same engine, but with the two-plane ("forked") mode permanently active:
 * one transition write to a dummy atom never folds, so every subsequent
 * plain write maintains BOTH planes and every read takes the forked code
 * paths. Measures the worst-case overhead of concurrent-world bookkeeping —
 * in a real app this state only exists while a transition is pending.
 */
export const cosignalForkedFramework: ReactiveFramework = {
  ...makeFramework("cosignal (forked)"),
  withBuild: (fn) => {
    if (!isForked()) {
      const dummy = new Atom({ state: 0 });
      setWriteBatchProvider(() => ({ deferred: true }));
      dummy.set(1); // enters forked mode; the batch never retires
      setWriteBatchProvider(null);
    }
    return fn();
  },
};
