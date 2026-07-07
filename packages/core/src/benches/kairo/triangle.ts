import { Counter } from "../../util/counter";
import { ReactiveFramework } from "../../util/reactiveFramework";

let width = 10;

export function triangle<S>(bridge: ReactiveFramework<S>) {
  let head = bridge.createSignal(0);
  let current = head;
  let list: S[] = [];
  for (let i = 0; i < width; i++) {
    let c = current;
    list.push(current);
    current = bridge.createComputed(() => {
      return (bridge.readComputed(c) as number) + 1;
    });
  }
  let sum = bridge.createComputed(() => {
    return list
      .map((x) => bridge.readComputed(x) as number)
      .reduce((a, b) => a + b, 0);
  });

  let callCounter = new Counter();
  bridge.effect(() => {
    bridge.readComputed(sum);
    callCounter.count++;
  });

  return () => {
    const constant = count(width);
    bridge.withBatch(() => {
      bridge.writeSignal(head, 1);
    });
    console.assert(bridge.readComputed(sum) === constant);
    const atleast = 100;
    callCounter.count = 0;
    for (let i = 0; i < 100; i++) {
      bridge.withBatch(() => {
        bridge.writeSignal(head, i);
      });
      console.assert(bridge.readComputed(sum) === constant - width + i * width);
    }
    console.assert(callCounter.count === atleast);
  };
}

function count(number: Number) {
  return new Array(number)
    .fill(0)
    .map((_, i) => i + 1)
    .reduce((x, y) => x + y, 0);
}
