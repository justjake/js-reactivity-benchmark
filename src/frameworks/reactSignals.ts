import { ReactiveFramework } from "../util/reactiveFramework";
import {
  Atom,
  Computed,
  effect,
  batch,
} from "../../../../packages/react-signals/src/core/index.ts";

export const reactSignalsFramework: ReactiveFramework = {
  name: "react-signals",
  signal: (initialValue) => {
    const a = new Atom({ state: initialValue });
    return {
      read: () => a.state,
      write: (v) => {
        a.state = v;
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
