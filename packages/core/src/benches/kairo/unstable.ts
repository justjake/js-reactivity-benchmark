import { Counter } from "../../util/counter";
import { ReactiveFramework } from "../../util/reactiveFramework";

/** worst case. */
export function unstable<S>(bridge: ReactiveFramework<S>) {
  let head = bridge.createSignal(0);
  const double = bridge.createComputed(
    () => (bridge.readSignal(head) as number) * 2,
  );
  const inverse = bridge.createComputed(
    () => -(bridge.readSignal(head) as number),
  );
  let current = bridge.createComputed(() => {
    let result = 0;
    for (let i = 0; i < 20; i++) {
      result += (
        (bridge.readSignal(head) as number) % 2
          ? bridge.readComputed(double)
          : bridge.readComputed(inverse)
      ) as number;
    }
    return result;
  });

  let callCounter = new Counter();
  bridge.effect(() => {
    bridge.readComputed(current);
    callCounter.count++;
  });
  return () => {
    bridge.withBatch(() => {
      bridge.writeSignal(head, 1);
    });
    console.assert(bridge.readComputed(current) === 40);
    const atleast = 100;
    callCounter.count = 0;
    for (let i = 0; i < 100; i++) {
      bridge.withBatch(() => {
        bridge.writeSignal(head, i);
      });
      // console.assert(bridge.readComputed(current) === i % 2 ? i * 2 * 10 : i * -10);
    }
    console.assert(callCounter.count === atleast);
  };
}
