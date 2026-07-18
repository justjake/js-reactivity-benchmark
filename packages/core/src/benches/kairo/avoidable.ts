import { EffectStyle } from "../../util/effectStyle";
import { ReactiveFramework } from "../../util/reactiveFramework";
import { busy } from "./util";

/** avoidable change propagation  */
export function avoidablePropagation<S>(
  bridge: ReactiveFramework<S>,
  style: EffectStyle,
) {
  let head = bridge.createSignal(0);
  let computed1 = bridge.createComputed(() => bridge.readSignal(head));
  let computed2 = bridge.createComputed(
    () => (bridge.readComputed(computed1), 0),
  );
  let computed3 = bridge.createComputed(
    () => (busy(), (bridge.readComputed(computed2) as number) + 1),
  ); // heavy computation
  let computed4 = bridge.createComputed(
    () => (bridge.readComputed(computed3) as number) + 2,
  );
  let computed5 = bridge.createComputed(
    () => (bridge.readComputed(computed4) as number) + 3,
  );
  // computed5 is constant, so the heavy side effect should never re-run:
  // change-cutoff frameworks never re-run the tracked body, and pair
  // frameworks additionally skip the reaction because the value is unchanged.
  if (style === "pair") {
    bridge.effectPair!(
      () => bridge.readComputed(computed5),
      () => {
        busy(); // heavy side effect
      },
    );
  } else {
    bridge.effect(() => {
      bridge.readComputed(computed5);
      busy(); // heavy side effect
    });
  }

  return () => {
    bridge.withBatch(() => {
      bridge.writeSignal(head, 1);
    });
    console.assert(bridge.readComputed(computed5) === 6);
    for (let i = 0; i < 1000; i++) {
      bridge.withBatch(() => {
        bridge.writeSignal(head, i);
      });
      console.assert(bridge.readComputed(computed5) === 6);
    }
  };
}
