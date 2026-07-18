import { makeGraph, runGraph } from "./benches/reactively/dependencyGraph";
import { expect, test } from "vitest";
import { FrameworkInfo, TestConfig } from "./util/frameworkTypes";
import { frameworkInfo } from "./frameworksList";
import { lazyFrameworkInfo } from "./frameworksLazy";

frameworkInfo.forEach((frameworkInfo) => frameworkTests(frameworkInfo));

// frameworksLazy duplicates each adapter's name as a literal (importing the
// adapter to read its name would defeat the lazy loading). Pin the copies
// together: every lazy entry must load an adapter with the same name, and
// the lazy registry must cover exactly the active frameworkInfo list.
test("lazyFrameworkInfo mirrors frameworkInfo", async () => {
  const eagerNames = frameworkInfo.map((f) => f.framework.name);
  const lazyNames = lazyFrameworkInfo.map((f) => f.name);
  expect(lazyNames).toEqual(eagerNames);
  for (const [i, entry] of lazyFrameworkInfo.entries()) {
    const loaded = await entry.load();
    expect(loaded.framework.name).toBe(entry.name);
    expect(loaded.testPullCounts).toBe(frameworkInfo[i].testPullCounts);
  }
});

function makeConfig(): TestConfig {
  return {
    width: 3,
    totalLayers: 3,
    staticFraction: 1,
    nSources: 2,
    readFraction: 1,
    expected: {},
    iterations: 1,
  };
}

/** some basic tests to validate the reactive framework
 * wrapper works and can run performance tests.
 */
function frameworkTests({ framework, testPullCounts }: FrameworkInfo) {
  const name = framework.name;
  test(`${name} | simple dependency executes`, () => {
    const s = framework.createSignal(2);
    const c = framework.createComputed(
      () => (framework.readSignal(s) as number) * 2,
    );

    expect(framework.readComputed(c)).toEqual(4);
  });

  test(`${name} | static graph`, () => {
    const config = makeConfig();
    const { graph, counter } = makeGraph(framework, 1, config);
    const sum = runGraph(graph, 2, framework);
    expect(sum).toEqual(16);
    expect(counter.count).toEqual(11);
  });

  test(`${name} | static graph, read 2/3 of leaves`, () => {
    const config = makeConfig();
    config.readFraction = 2 / 3;
    config.iterations = 10;
    const { counter, graph } = makeGraph(framework, 2 / 3, config);
    const sum = runGraph(graph, 10, framework);

    expect(sum).toEqual(72);
    if (testPullCounts) {
      expect(counter.count).toEqual(41);
    }
  });

  test(`${name} | dynamic graph`, () => {
    const config = makeConfig();
    config.staticFraction = 0.5;
    config.width = 4;
    config.totalLayers = 2;
    const { graph, counter } = makeGraph(framework, 1, config);
    const sum = runGraph(graph, 10, framework);

    expect(sum).toEqual(72);
    expect(counter.count).toEqual(22);
  });

  // Pair-style coverage, only for frameworks whose effects natively take
  // the (compute, reaction) shape.
  if (framework.effectPair) {
    test(`${name} | static graph, pair effect style`, () => {
      const config = makeConfig();
      const { graph, counter } = makeGraph(framework, 1, config, "pair");
      const sum = runGraph(graph, 2, framework);
      expect(sum).toEqual(16);
      expect(counter.count).toEqual(11);
      framework.cleanup();
    });

    test(`${name} | effectPair reaction sees changed values`, () => {
      const seen: unknown[] = [];
      const s = framework.withBuild(() => {
        const s = framework.createSignal(0);
        framework.effectPair!(
          () => framework.readSignal(s),
          (value) => {
            seen.push(value);
          },
        );
        return s;
      });
      framework.withBatch(() => framework.writeSignal(s, 1));
      framework.withBatch(() => framework.writeSignal(s, 2));
      // Whether the reaction runs at creation time is framework-defined, so
      // only the writes' deliveries are asserted.
      expect(seen.slice(-2)).toEqual([1, 2]);
      framework.cleanup();
    });
  }
}
