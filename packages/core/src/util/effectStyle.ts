import { ReactiveFramework } from "./reactiveFramework";

/** Which adapter entry point a benchmark uses to create its effects.
 *
 * - "tracked": ReactiveFramework.effect — one auto-tracked body that reads
 *   cells and performs the side effect. This is the historical shape of
 *   every bench in this suite, and it runs for every framework.
 * - "pair": ReactiveFramework.effectPair — the same workload split into a
 *   tracked compute and an untracked reaction. Only frameworks whose
 *   effects natively take that shape implement effectPair, and only those
 *   frameworks run the pair variant; benches may assume effectPair is
 *   present when they are built with style "pair".
 *
 * Benches take the style as a graph-construction parameter and branch at
 * each effect creation site rather than through a shared wrapper, so the
 * "tracked" rows keep the exact fused closures they have always measured
 * (a wrapper would add two closure allocations and a call per effect, which
 * is visible in creation-heavy benches).
 */
export type EffectStyle = "tracked" | "pair";

/** The styles to benchmark for one framework: always "tracked", plus "pair"
 * when the adapter implements the native pair shape. */
export function stylesFor(
  framework: ReactiveFramework<any>,
): readonly EffectStyle[] {
  return framework.effectPair ? ["tracked", "pair"] : ["tracked"];
}

/** Row name for a test run under the given style. Tracked rows keep their
 * historical names so results stay comparable across suite versions. */
export function styledTestName(name: string, style: EffectStyle): string {
  switch (style) {
    case "tracked":
      return name;
    case "pair":
      return `${name} (pair)`;
    default: {
      const impossible: never = style;
      throw new Error(`unknown effect style ${String(impossible)}`);
    }
  }
}
