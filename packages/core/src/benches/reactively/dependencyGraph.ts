import { Counter } from "../../util/counter";
import { EffectStyle } from "../../util/effectStyle";
import { TestConfig } from "../../util/frameworkTypes";
import { pseudoRandom } from "../../util/pseudoRandom";
import { ReactiveFramework } from "../../util/reactiveFramework";

// The leaf effect only exists to keep the read leaves observed; it has no
// side-effect half, so the pair variant uses a shared no-op reaction.
const NOOP_REACTION = (): void => {};

export interface Graph<S> {
  sources: S[];
  layers: S[][];
  readLeaves: S[];
}

export interface GraphAndCounter<S> {
  graph: Graph<S>;
  counter: Counter;
}

/**
 * Make a rectangular dependency graph, with an equal number of source elements
 * and computation elements at every layer.
 *
 * @param width number of source elements and number of computed elements per layer
 * @param totalLayers total number of source and computed layers
 * @param staticFraction every nth computed node is static (1 = all static, 3 = 2/3rd are dynamic)
 * @returns the graph
 */
export function makeGraph<S>(
  framework: ReactiveFramework<S>,
  readFraction: number,
  config: TestConfig,
  style: EffectStyle = "tracked",
): GraphAndCounter<S> {
  const { width, totalLayers, staticFraction, nSources } = config;

  return framework.withBuild(() => {
    const sources = new Array(width)
      .fill(0)
      .map((_, i) => framework.createSignal(i));
    const counter = new Counter();
    const rows = makeDependentRows(
      sources,
      totalLayers - 1,
      counter,
      staticFraction,
      nSources,
      framework,
    );

    const rand = pseudoRandom();
    const leaves = rows[rows.length - 1];
    const skipCount = Math.round(leaves.length * (1 - readFraction));
    const readLeaves = removeElems(leaves, skipCount, rand);
    if (style === "pair") {
      framework.effectPair!(() => {
        let last: unknown;
        for (const leaf of readLeaves) {
          last = framework.readComputed(leaf);
        }
        return last;
      }, NOOP_REACTION);
    } else {
      framework.effect(() => {
        for (const leaf of readLeaves) {
          framework.readComputed(leaf);
        }
      });
    }

    const graph = { sources, layers: rows, readLeaves };
    return { graph, counter };
  });
}

/**
 * Execute the graph by writing one of the sources and reading some or all of the leaves.
 *
 * @return the sum of all leaf values
 */
export function runGraph<S>(
  graph: Graph<S>,
  iterations: number,
  framework: ReactiveFramework<S>,
): number {
  const { sources, readLeaves } = graph;

  for (let i = 0; i < iterations; i++) {
    framework.withBatch(() => {
      const sourceDex = i % sources.length;
      framework.writeSignal(sources[sourceDex], i + sourceDex);
    });
    for (const leaf of readLeaves) {
      framework.readComputed(leaf);
    }
  }

  const sum = readLeaves.reduce(
    (total, leaf) => (framework.readComputed(leaf) as number) + total,
    0,
  );
  return sum;
}

function removeElems<T>(src: T[], rmCount: number, rand: () => number): T[] {
  const copy = src.slice();
  for (let i = 0; i < rmCount; i++) {
    const rmDex = Math.floor(rand() * copy.length);
    copy.splice(rmDex, 1);
  }
  return copy;
}

function makeDependentRows<S>(
  sources: S[],
  numRows: number,
  counter: Counter,
  staticFraction: number,
  nSources: number,
  framework: ReactiveFramework<S>,
): S[][] {
  let prevRow = sources;
  const random = pseudoRandom();
  const rows = [];
  for (let l = 0; l < numRows; l++) {
    const row = makeRow(
      prevRow,
      counter,
      staticFraction,
      nSources,
      framework,
      l,
      random,
    );
    rows.push(row);
    prevRow = row;
  }
  return rows;
}

function makeRow<S>(
  sources: S[],
  counter: Counter,
  staticFraction: number,
  nSources: number,
  framework: ReactiveFramework<S>,
  _layer: number,
  random: () => number,
): S[] {
  return sources.map((_, myDex) => {
    const mySources: S[] = [];
    for (let sourceDex = 0; sourceDex < nSources; sourceDex++) {
      mySources.push(sources[(myDex + sourceDex) % sources.length]);
    }

    const staticNode = random() < staticFraction;
    if (staticNode) {
      // static node, always reference sources
      return framework.createComputed(() => {
        counter.count++;

        let sum = 0;
        for (const src of mySources) {
          sum += framework.readComputed(src) as number;
        }
        return sum;
      });
    } else {
      // dynamic node, drops one of the sources depending on the value of the first element
      const first = mySources[0];
      const tail = mySources.slice(1);
      const node = framework.createComputed(() => {
        counter.count++;
        let sum = framework.readComputed(first) as number;
        const shouldDrop = sum & 0x1;
        const dropDex = sum % tail.length;

        for (let i = 0; i < tail.length; i++) {
          if (shouldDrop && i === dropDex) continue;
          sum += framework.readComputed(tail[i]) as number;
        }

        return sum;
      });
      return node;
    }
  });
}
