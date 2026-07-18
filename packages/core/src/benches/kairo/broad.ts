import { Counter } from "../../util/counter";
import { EffectStyle } from "../../util/effectStyle";
import { ReactiveFramework } from "../../util/reactiveFramework";

/** broad propagation */
export function broadPropagation<S>(
  bridge: ReactiveFramework<S>,
  style: EffectStyle,
) {
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
    // Each effect's value tracks head, so it changes on every counted write
    // and the pair reaction fires exactly as often as the tracked body.
    if (style === "pair") {
      bridge.effectPair!(
        () => bridge.readComputed(current2),
        () => {
          callCounter.count++;
        },
      );
    } else {
      bridge.effect(() => {
        bridge.readComputed(current2);
        callCounter.count++;
      });
    }
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
