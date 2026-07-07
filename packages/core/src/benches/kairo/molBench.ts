import { ReactiveFramework } from "../../util/reactiveFramework";

function fib(n: number): number {
  if (n < 2) return 1;
  return fib(n - 1) + fib(n - 2);
}

function hard(n: number, _log: string) {
  return n + fib(16);
}

const numbers = Array.from({ length: 5 }, (_, i) => i);

/** the value type of computed D below */
type Points = { x: number }[];

export function mol<S>(framework: ReactiveFramework<S>) {
  let res: number[] = [];
  const A = framework.createSignal(0);
  const B = framework.createSignal(0);
  const C = framework.createComputed(
    () =>
      ((framework.readSignal(A) as number) % 2) +
      ((framework.readSignal(B) as number) % 2),
  );
  const D = framework.createComputed(() =>
    numbers.map((i) => ({
      x:
        i +
        ((framework.readSignal(A) as number) % 2) -
        ((framework.readSignal(B) as number) % 2),
    })),
  );
  const E = framework.createComputed(() =>
    hard(
      (framework.readComputed(C) as number) +
        (framework.readSignal(A) as number) +
        (framework.readComputed(D) as Points)[0].x,
      "E",
    ),
  );
  const F = framework.createComputed(() =>
    hard(
      (framework.readComputed(D) as Points)[2].x ||
        (framework.readSignal(B) as number),
      "F",
    ),
  );
  const G = framework.createComputed(
    () =>
      (framework.readComputed(C) as number) +
      ((framework.readComputed(C) as number) ||
        (framework.readComputed(E) as number) % 2) +
      (framework.readComputed(D) as Points)[4].x +
      (framework.readComputed(F) as number),
  );
  // H:
  framework.effect(() => {
    res.push(hard(framework.readComputed(G) as number, "H"));
  });
  // I:
  framework.effect(() => {
    res.push(framework.readComputed(G) as number);
  });
  // J:
  framework.effect(() => {
    res.push(hard(framework.readComputed(F) as number, "J"));
  });

  let i = 0;
  return () => {
    i++;
    res.length = 0;
    framework.withBatch(() => {
      framework.writeSignal(B, 1);
      framework.writeSignal(A, 1 + i * 2);
    });
    framework.withBatch(() => {
      framework.writeSignal(A, 2 + i * 2);
      framework.writeSignal(B, 2);
    });
  };
}
