import { ReactiveFramework } from "../util/reactiveFramework";
import {
  signal,
  computed,
  effect,
  Injector,
  ɵChangeDetectionScheduler,
  ɵEffectScheduler,
  untracked,
  type Signal,
  type WritableSignal,
} from "@angular/core";

interface SchedulableEffect {
  run(): void;
}
export class ArrayEffectScheduler implements ɵEffectScheduler {
  private queue = new Set<SchedulableEffect>();

  schedule(handle: SchedulableEffect): void {
    this.queue.add(handle);
  }

  add(e: SchedulableEffect): void {
    this.queue.add(e);
  }

  remove(handle: SchedulableEffect): void {
    if (!this.queue.has(handle)) {
      return;
    }

    this.queue.delete(handle);
  }

  flush(): void {
    for (const handle of this.queue) {
      handle.run();
    }
    this.queue.clear();
  }
}

const scheduler = new ArrayEffectScheduler();

const createInjector = () => ({
  injector: Injector.create({
    providers: [
      { provide: ɵChangeDetectionScheduler, useValue: { notify() {} } },
      { provide: ɵEffectScheduler, useValue: scheduler },
    ],
  }),
});

let injectorObj = createInjector();

// A cell is Angular's own signal getter; writable signals carry .set.
type AngularCell = Signal<unknown>;

export const angularFramework: ReactiveFramework<AngularCell> = {
  name: "Angular Signals",
  createSignal: (initialValue) => signal(initialValue),
  readSignal: (s) => s(),
  writeSignal: (s, value) => {
    (s as WritableSignal<unknown>).set(value);
  },
  createComputed: (fn) => computed(fn),
  readComputed: (c) => c(),
  effect: (fn) => {
    effect(fn, injectorObj);
  },
  withBatch: (fn) => {
    fn();
    scheduler.flush();
  },
  withBuild: <T>(fn: () => T) => {
    let res: T;
    effect(() => {
      res = untracked(fn);
    }, injectorObj);
    scheduler.flush();
    return res!;
  },
  cleanup: () => {
    injectorObj.injector.destroy();
    injectorObj = createInjector();
  },
};
