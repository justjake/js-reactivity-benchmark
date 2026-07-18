import { batch, createAtom } from "@tanstack/store";
import type { Atom, ReadonlyAtom, Subscription } from "@tanstack/store";
import { ReactiveFramework } from "../util/reactiveFramework";

// @tanstack/store 0.11.0 rebuilt its core as an atom graph with automatic
// dependency tracking (the push-pull algorithm is a vendored copy of
// alien-signals). The pre-0.11 Derived/Effect classes that required explicit
// `deps` arrays are gone, so every suite here — including the ones that
// change their dependency sets at runtime — runs on the real public API with
// no dependency-discovery shim. Benchmark numbers therefore measure
// TanStack's atom layer over an alien-signals-family core, not an
// independent propagation algorithm.
//
// A cell is the package's own atom object: signals and computeds both read
// via .get(); writable atoms add .set(). createAtom() and .set() treat a
// function argument as a compute/updater function, so this adapter assumes
// cell values are plain data — true for every benchmark in this repo.
type TanStackCell = ReadonlyAtom<unknown> & {
  set?: (value: unknown) => void;
};

// The package exports no general-purpose effect; the only public way to run
// a callback eagerly on change is Subscribable.subscribe, and a subscription
// observes exactly one atom. Wrapping the effect body in a computed atom and
// subscribing to it restores multi-source effects: the computed tracks
// whatever fn reads, and because fn returns undefined the computed registers
// every recomputation as a change and wakes its subscriber. The subscriber
// callback itself is a no-op — fn already ran inside the computed.
const noopObserver = () => {};

// subscribe() returns the only handle that detaches the internal effect from
// its sources; retain every one so cleanup() can sever whole benchmark
// graphs between rounds.
let subscriptions: Subscription[] = [];

export const tanstackStoreFramework: ReactiveFramework<TanStackCell> = {
  name: "TanStack Store",
  createSignal: (initialValue) => createAtom(initialValue) as Atom<unknown>,
  readSignal: (s) => s.get(),
  writeSignal: (s, value) => {
    s.set!(value);
  },
  createComputed: (fn) => createAtom(fn),
  readComputed: (c) => c.get(),
  effect: (fn) => {
    subscriptions.push(createAtom(fn).subscribe(noopObserver));
  },
  // The native pair here is a computed atom plus a subscription: the atom
  // tracks what compute reads and only wakes subscribers when its value
  // changes, and the subscriber runs untracked with that value.
  effectPair: (compute, reaction) => {
    const atom = createAtom(compute);
    subscriptions.push(atom.subscribe(() => reaction(atom.get())));
  },
  withBatch: (fn) => batch(fn),
  withBuild: (fn) => fn(),
  cleanup: () => {
    const disposing = subscriptions;
    subscriptions = [];
    for (const subscription of disposing) {
      subscription.unsubscribe();
    }
  },
};
