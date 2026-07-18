import { Counter } from "../../util/counter";
import { EffectStyle } from "../../util/effectStyle";
import { ReactiveFramework } from "../../util/reactiveFramework";

let size = 30;

/** repeated observers */
export function repeatedObservers<S>(
  bridge: ReactiveFramework<S>,
  style: EffectStyle,
) {
  let head = bridge.createSignal(0);
  let current = bridge.createComputed(() => {
    let result = 0;
    for (let i = 0; i < size; i++) {
      // tbh I think it's meanigless to be this big...
      result += bridge.readSignal(head) as number;
    }
    return result;
  });

  let callCounter = new Counter();
  // The effect's value is head * size, so it changes on every counted write
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

  return () => {
    bridge.withBatch(() => {
      bridge.writeSignal(head, 1);
    });
    console.assert(bridge.readComputed(current) === size);
    const atleast = 100;
    callCounter.count = 0;
    for (let i = 0; i < 100; i++) {
      bridge.withBatch(() => {
        bridge.writeSignal(head, i);
      });
      console.assert(bridge.readComputed(current) === i * size);
    }
    console.assert(callCounter.count === atleast);
  };
}
