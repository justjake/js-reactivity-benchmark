import { Counter } from "../../util/counter";
import { ReactiveFramework } from "../../util/reactiveFramework";

/** broad propagation */
export function broadPropagation<S>(bridge: ReactiveFramework<S>) {
  let head = bridge.createSignal(0);
  let last = head;
  let callCounter = new Counter();
  for (let i = 0; i < 50; i++) {
    let current = bridge.createComputed(() => {
      return (bridge.readSignal(head) as number) + i;
    });
    let current2 = bridge.createComputed(() => {
      return (bridge.readComputed(current) as number) + 1;
    });
    bridge.effect(() => {
      bridge.readComputed(current2);
      callCounter.count++;
    });
    last = current2;
  }

  return () => {
    bridge.withBatch(() => {
      bridge.writeSignal(head, 1);
    });
    const atleast = 50 * 50;
    callCounter.count = 0;
    for (let i = 0; i < 50; i++) {
      bridge.withBatch(() => {
        bridge.writeSignal(head, i);
      });
      console.assert(bridge.readComputed(last) === i + 50);
    }
    console.assert(callCounter.count === atleast, callCounter.count);
  };
}
