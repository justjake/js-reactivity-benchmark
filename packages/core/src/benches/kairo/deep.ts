import { Counter } from "../../util/counter";
import { EffectStyle } from "../../util/effectStyle";
import { ReactiveFramework } from "../../util/reactiveFramework";
let len = 50;

/** deep propagation */
export function deepPropagation<S>(
  bridge: ReactiveFramework<S>,
  style: EffectStyle,
) {
  let head = bridge.createSignal(0);
  let current = head;
  for (let i = 0; i < len; i++) {
    let c = current;
    current = bridge.createComputed(() => {
      return (bridge.readComputed(c) as number) + 1;
    });
  }
  let callCounter = new Counter();

  // The effect's value is len + head, so it changes on every counted write
  // and the pair reaction fires exactly as often as the tracked body.
  if (style === "pair") {
    bridge.effectPair!(
      () => bridge.readComputed(current),
      () => {
        callCounter.count++;
      },
    );
  } else {
    bridge.effect(() => {
      bridge.readComputed(current);
      callCounter.count++;
    });
  }

  const iter = 50;

  return () => {
    bridge.withBatch(() => {
      bridge.writeSignal(head, 1);
    });
    const atleast = iter;
    callCounter.count = 0;
    for (let i = 0; i < iter; i++) {
      bridge.withBatch(() => {
        bridge.writeSignal(head, i);
      });
      console.assert(bridge.readComputed(current) === len + i);
    }

    console.assert(callCounter.count === atleast);
  };
}
