import { Counter } from "../../util/counter";
import { ReactiveFramework } from "../../util/reactiveFramework";

let width = 5;

export function diamond<S>(bridge: ReactiveFramework<S>) {
  let head = bridge.createSignal(0);
  let current: S[] = [];
  for (let i = 0; i < width; i++) {
    current.push(
      bridge.createComputed(() => {
        return (bridge.readSignal(head) as number) + 1;
      }),
    );
  }
  let sum = bridge.createComputed(() => {
    return current
      .map((x) => bridge.readComputed(x) as number)
      .reduce((a, b) => a + b, 0);
  });
  let callCounter = new Counter();
  bridge.effect(() => {
    bridge.readComputed(sum);
    callCounter.count++;
  });

  return () => {
    bridge.withBatch(() => {
      bridge.writeSignal(head, 1);
    });
    console.assert(bridge.readComputed(sum) === 2 * width);
    const atleast = 500;
    callCounter.count = 0;
    for (let i = 0; i < 500; i++) {
      bridge.withBatch(() => {
        bridge.writeSignal(head, i);
      });
      console.assert(bridge.readComputed(sum) === (i + 1) * width);
    }
    console.assert(callCounter.count === atleast);
  };
}
