import { ReactiveFramework } from "../../util/reactiveFramework";

export function mux<S>(bridge: ReactiveFramework<S>) {
  let heads = new Array(100).fill(null).map((_) => bridge.createSignal(0));
  const mux = bridge.createComputed(() => {
    return Object.fromEntries(heads.map((h) => bridge.readSignal(h)).entries());
  });
  const splited = heads
    .map((_, index) =>
      bridge.createComputed(
        () => (bridge.readComputed(mux) as Record<number, number>)[index],
      ),
    )
    .map((x) =>
      bridge.createComputed(() => (bridge.readComputed(x) as number) + 1),
    );

  splited.forEach((x) => {
    bridge.effect(() => {
      bridge.readComputed(x);
    });
  });
  return () => {
    for (let i = 0; i < 10; i++) {
      bridge.withBatch(() => {
        bridge.writeSignal(heads[i], i);
      });
      console.assert(bridge.readComputed(splited[i]) === i + 1);
    }
    for (let i = 0; i < 10; i++) {
      bridge.withBatch(() => {
        bridge.writeSignal(heads[i], i * 2);
      });
      console.assert(bridge.readComputed(splited[i]) === i * 2 + 1);
    }
  };
}
