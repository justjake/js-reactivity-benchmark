// Inspired by https://github.com/solidjs/solid/blob/main/packages/solid/bench/bench.cjs

import { nextTick } from "../util/asyncUtil";
import { medianOf } from "../util/medianOf";
import { PerfResultCallback } from "../util/perfLogging";
import { ReactiveFramework } from "../util/reactiveFramework";

const COUNT = 1e5;

function empty() {}

export async function sbench<S>(
  framework: ReactiveFramework<S>,
  logPerfResult: PerfResultCallback,
) {
  const createSignalsTime = await run(createSignals, COUNT, COUNT);
  logPerfResult({
    framework: framework.name,
    test: "createSignals",
    time: createSignalsTime,
  });

  let createTotal = 0;
  createTotal += await run(create0to1, COUNT, 0);
  createTotal += await run(create1to1, COUNT, COUNT);
  createTotal += await run(create2to1, COUNT / 2, COUNT);
  createTotal += await run(create4to1, COUNT / 4, COUNT);
  createTotal += await run(create1000to1, COUNT / 1000, COUNT);
  createTotal += await run(create1to2, COUNT, COUNT / 2);
  createTotal += await run(create1to4, COUNT, COUNT / 4);
  createTotal += await run(create1to8, COUNT, COUNT / 8);
  createTotal += await run(create1to1000, COUNT, COUNT / 1000);
  logPerfResult({
    framework: framework.name,
    test: "createComputations",
    time: createTotal,
  });

  let updateTotal = 0;
  updateTotal += await run(update1to1, COUNT * 4, 1);
  updateTotal += await run(update2to1, COUNT * 2, 2);
  updateTotal += await run(update4to1, COUNT, 4);
  updateTotal += await run(update1000to1, COUNT / 250, 1000);
  updateTotal += await run(update1to2, COUNT, 1);
  updateTotal += await run(update1to4, COUNT, 1);
  updateTotal += await run(update1to1000, COUNT, 1);
  logPerfResult({
    framework: framework.name,
    test: "updateSignals",
    time: updateTotal,
  });

  async function run(
    fn: (n: number, sources: S[]) => () => void,
    n: number,
    scount: number,
  ) {
    let sources: S[] | null;
    if (globalThis.gc) (gc!(), gc!());
    for (let i = 0; i < 3; i++) {
      let warmupUpdate = framework.withBuild(() => {
        // run 3 times to warm up
        sources = [];
        createSignals(scount, sources);
        return fn(n / 100, sources);
      });
      warmupUpdate();
    }
    sources = null;
    framework.cleanup();

    // start GC clean
    if (globalThis.gc) (gc!(), gc!());
    await nextTick();

    const runTimes: number[] = [];
    for (let i = 0; i < 10; i++) {
      let start = 0;
      let end = 0;
      let update = framework.withBuild(() => {
        sources = [];
        createSignals(scount, sources);
        for (let i = 0; i < scount; i++) {
          framework.readSignal(sources[i]);
          framework.readSignal(sources[i]);
          framework.readSignal(sources[i]);
        }

        start = performance.now();

        return fn(n, sources);
      });

      update();
      sources = null;
      framework.cleanup();
      end = performance.now();

      // end GC clean
      if (globalThis.gc) (gc!(), gc!());

      runTimes.push(end - start);
    }
    return medianOf(runTimes);
  }

  function createSignals(n: number, sources: S[]) {
    for (let i = 0; i < n; i++) {
      sources[i] = framework.createSignal(i);
    }
    return empty;
  }

  function create0to1(n: number, _sources: S[]) {
    for (let i = 0; i < n; i++) {
      createComputation0(i);
    }
    return empty;
  }

  function create1to1000(n: number, sources: S[]) {
    for (let i = 0; i < n / 1000; i++) {
      const source = sources[i];
      for (let j = 0; j < 1000; j++) {
        createComputation1(source);
      }
    }
    return empty;
  }

  function create1to8(n: number, sources: S[]) {
    for (let i = 0; i < n / 8; i++) {
      const source = sources[i];
      createComputation1(source);
      createComputation1(source);
      createComputation1(source);
      createComputation1(source);
      createComputation1(source);
      createComputation1(source);
      createComputation1(source);
      createComputation1(source);
    }
    return empty;
  }

  function create1to4(n: number, sources: S[]) {
    for (let i = 0; i < n / 4; i++) {
      const source = sources[i];
      createComputation1(source);
      createComputation1(source);
      createComputation1(source);
      createComputation1(source);
    }
    return empty;
  }

  function create1to2(n: number, sources: S[]) {
    for (let i = 0; i < n / 2; i++) {
      const source = sources[i];
      createComputation1(source);
      createComputation1(source);
    }
    return empty;
  }

  function create1to1(n: number, sources: S[]) {
    for (let i = 0; i < n; i++) {
      createComputation1(sources[i]);
    }
    return empty;
  }

  function create2to1(n: number, sources: S[]) {
    for (let i = 0; i < n; i++) {
      createComputation2(sources[i * 2], sources[i * 2 + 1]);
    }
    return empty;
  }

  function create4to1(n: number, sources: S[]) {
    for (let i = 0; i < n; i++) {
      createComputation4(
        sources[i * 4],
        sources[i * 4 + 1],
        sources[i * 4 + 2],
        sources[i * 4 + 3],
      );
    }
    return empty;
  }

  // only create n / 100 computations, as otherwise takes too long
  function create1000to1(n: number, sources: S[]) {
    for (let i = 0; i < n; i++) {
      createComputation1000(sources, i * 1000);
    }
    return empty;
  }

  function createComputation0(i: number) {
    framework.effect(() => {
      // 0-source effect; capture i so each effect gets a distinct closure
      void i;
    });
    return empty;
  }

  function createComputation1(s1: S) {
    framework.effect(() => {
      framework.readSignal(s1);
    });
    return empty;
  }
  function createComputation2(s1: S, s2: S) {
    framework.effect(() => {
      (framework.readSignal(s1) as number) +
        (framework.readSignal(s2) as number);
    });
    return empty;
  }

  function createComputation4(s1: S, s2: S, s3: S, s4: S) {
    framework.effect(() => {
      (framework.readSignal(s1) as number) +
        (framework.readSignal(s2) as number) +
        (framework.readSignal(s3) as number) +
        (framework.readSignal(s4) as number);
    });
    return empty;
  }

  function createComputation1000(ss: S[], offset: number) {
    framework.effect(() => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += framework.readSignal(ss[offset + i]) as number;
      }
    });
    return empty;
  }

  function update1to1(n: number, sources: S[]) {
    const s0 = sources[0];
    framework.effect(() => {
      framework.readSignal(s0);
    });
    return () => {
      for (let i = 0; i < n; i++) {
        framework.withBatch(() => {
          framework.writeSignal(s0, i);
        });
      }
    };
  }

  function update2to1(n: number, sources: S[]) {
    const s0 = sources[0];
    const s1 = sources[1];
    framework.effect(() => {
      (framework.readSignal(s0) as number) +
        (framework.readSignal(s1) as number);
    });
    return () => {
      for (let i = 0; i < n; i++) {
        framework.withBatch(() => {
          framework.writeSignal(s0, i);
        });
      }
    };
  }

  function update4to1(n: number, sources: S[]) {
    const s0 = sources[0];
    const s1 = sources[1];
    const s2 = sources[2];
    const s3 = sources[3];
    framework.effect(() => {
      (framework.readSignal(s0) as number) +
        (framework.readSignal(s1) as number) +
        (framework.readSignal(s2) as number) +
        (framework.readSignal(s3) as number);
    });
    return () => {
      for (let i = 0; i < n; i++) {
        framework.withBatch(() => {
          framework.writeSignal(s0, i);
        });
      }
    };
  }

  function update1000to1(n: number, sources: S[]) {
    const s0 = sources[0];
    framework.effect(() => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += framework.readSignal(sources[i]) as number;
      }
    });
    return () => {
      for (let i = 0; i < n; i++) {
        framework.withBatch(() => {
          framework.writeSignal(s0, i);
        });
      }
    };
  }

  function update1to2(n: number, sources: S[]) {
    const s0 = sources[0];
    framework.effect(() => {
      framework.readSignal(s0);
    });
    framework.effect(() => {
      framework.readSignal(s0);
    });
    return () => {
      for (let i = 0; i < n; i++) {
        framework.withBatch(() => {
          framework.writeSignal(s0, i);
        });
      }
    };
  }

  function update1to4(n: number, sources: S[]) {
    const s0 = sources[0];
    framework.effect(() => {
      framework.readSignal(s0);
    });
    framework.effect(() => {
      framework.readSignal(s0);
    });
    framework.effect(() => {
      framework.readSignal(s0);
    });
    framework.effect(() => {
      framework.readSignal(s0);
    });
    return () => {
      for (let i = 0; i < n; i++) {
        framework.withBatch(() => {
          framework.writeSignal(s0, i);
        });
      }
    };
  }

  function update1to1000(n: number, sources: S[]) {
    const s0 = sources[0];
    for (let i = 0; i < 1000; i++) {
      framework.effect(() => {
        framework.readSignal(s0);
      });
    }
    return () => {
      for (let i = 0; i < n / 10; i++) {
        framework.withBatch(() => {
          framework.writeSignal(s0, i);
        });
      }
    };
  }
}
