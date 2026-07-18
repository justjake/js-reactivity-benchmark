// The following is an implementation of the cellx benchmark https://github.com/Riim/cellx/blob/master/perf/perf.html
import { nextTick } from "../util/asyncUtil";
import {
  EffectStyle,
  stylesFor,
  styledTestName,
} from "../util/effectStyle";
import { FrameworkInfo } from "../util/frameworkTypes";
import { PerfResultCallback } from "../util/perfLogging";
import { ReactiveFramework } from "../util/reactiveFramework";

// The per-layer effects only exist to keep the computed props observed; they
// have no side-effect half, so the pair variant uses a shared no-op reaction.
const NOOP_REACTION = (): void => {};

const cellx = <S>(
  framework: ReactiveFramework<S>,
  layers: number,
  style: EffectStyle,
) => {
  const iter = framework.withBuild(() => {
    const start = {
      prop1: framework.createSignal(1),
      prop2: framework.createSignal(2),
      prop3: framework.createSignal(3),
      prop4: framework.createSignal(4),
    };

    let layer: {
      prop1: S;
      prop2: S;
      prop3: S;
      prop4: S;
    } = start;

    for (let i = layers; i > 0; i--) {
      const m = layer;
      const s = {
        prop1: framework.createComputed(() => framework.readComputed(m.prop2)),
        prop2: framework.createComputed(
          () =>
            (framework.readComputed(m.prop1) as number) -
            (framework.readComputed(m.prop3) as number),
        ),
        prop3: framework.createComputed(
          () =>
            (framework.readComputed(m.prop2) as number) +
            (framework.readComputed(m.prop4) as number),
        ),
        prop4: framework.createComputed(() => framework.readComputed(m.prop3)),
      };

      if (style === "pair") {
        framework.effectPair!(
          () => framework.readComputed(s.prop1),
          NOOP_REACTION,
        );
        framework.effectPair!(
          () => framework.readComputed(s.prop2),
          NOOP_REACTION,
        );
        framework.effectPair!(
          () => framework.readComputed(s.prop3),
          NOOP_REACTION,
        );
        framework.effectPair!(
          () => framework.readComputed(s.prop4),
          NOOP_REACTION,
        );
      } else {
        framework.effect(() => {
          framework.readComputed(s.prop1);
        });
        framework.effect(() => {
          framework.readComputed(s.prop2);
        });
        framework.effect(() => {
          framework.readComputed(s.prop3);
        });
        framework.effect(() => {
          framework.readComputed(s.prop4);
        });
      }

      layer = s;
    }

    const end = layer;

    return () => {
      const startTime = performance.now();

      const before = [
        framework.readComputed(end.prop1) as number,
        framework.readComputed(end.prop2) as number,
        framework.readComputed(end.prop3) as number,
        framework.readComputed(end.prop4) as number,
      ] as const;

      framework.withBatch(() => {
        framework.writeSignal(start.prop1, 4);
        framework.writeSignal(start.prop2, 3);
        framework.writeSignal(start.prop3, 2);
        framework.writeSignal(start.prop4, 1);
      });

      const after = [
        framework.readComputed(end.prop1) as number,
        framework.readComputed(end.prop2) as number,
        framework.readComputed(end.prop3) as number,
        framework.readComputed(end.prop4) as number,
      ] as const;

      const endTime = performance.now();
      const elapsedTime = endTime - startTime;

      return [elapsedTime, before, after] as const;
    };
  });

  let result = iter();

  framework.cleanup();
  if (globalThis.gc) (gc!(), gc!());

  return result;
};

const arraysEqual = (a: readonly number[], b: readonly number[]) => {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }

  return true;
};

type BenchmarkResults = [
  readonly [number, number, number, number],
  readonly [number, number, number, number],
];

export const cellxbench = async (
  frameworkInfo: FrameworkInfo[],
  logPerfResult: PerfResultCallback,
) => {
  const expected: Record<number, BenchmarkResults> = {
    1000: [
      [-3, -6, -2, 2],
      [-2, -4, 2, 3],
    ],
    2500: [
      [-3, -6, -2, 2],
      [-2, -4, 2, 3],
    ],
    // 5000: [
    //   [2, 4, -1, -6],
    //   [-2, 1, -4, -4],
    // ],
  };

  // warmup with all frameworks first
  for (const { framework } of frameworkInfo) {
    for (const style of stylesFor(framework)) {
      const layers = 1000;
      const [before, after] = expected[layers];
      const [_, b, a] = cellx(framework, Number(layers), style);

      console.assert(
        arraysEqual(b, before),
        `Expected first layer ${before}, found first layer ${b}`,
      );

      console.assert(
        arraysEqual(a, after),
        `Expected last layer ${after}, found last layer ${a}`,
      );
    }
  }

  // actual benchmark
  for (const { framework } of frameworkInfo) {
    for (const style of stylesFor(framework)) {
      const results: Record<number, BenchmarkResults> = {};

      for (const layers in expected) {
        let total = 0;
        for (let i = 0; i < 10; i++) {
          await nextTick();

          const [elapsed, before, after] = cellx(
            framework,
            Number(layers),
            style,
          );

          results[layers] = [before, after];

          total += elapsed;
        }

        logPerfResult({
          framework: framework.name,
          test: styledTestName(`cellx${layers}`, style),
          time: total,
        });
      }

      for (const layers in expected) {
        const [before, after] = results[layers];
        const [expectedBefore, expectedAfter] = expected[layers];

        console.assert(
          arraysEqual(before, expectedBefore),
          `Expected first layer ${expectedBefore}, found first layer ${before}`,
        );

        console.assert(
          arraysEqual(after, expectedAfter),
          `Expected last layer ${expectedAfter}, found last layer ${after}`,
        );
      }
    }
  }
};
