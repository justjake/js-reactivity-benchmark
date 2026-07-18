/** Adapter interface for benchmarking a reactive framework.
 *
 * The adapter is generic over S, the framework's own representation of a
 * reactive cell: a signal object, a callable, or a plain numeric id. Cells
 * flow through the benchmarks as opaque S values and every operation is a
 * static method on the adapter, so an adapter never allocates a wrapper
 * object or a read/write closure pair per cell. Cell values are `unknown` at
 * this boundary; each benchmark knows the concrete types of the cells it
 * creates and casts at the point of use.
 */
export interface ReactiveFramework<S = unknown> {
  name: string;

  /** Create a writable signal cell holding initialValue. */
  createSignal(initialValue: unknown): S;

  /** Read a cell statically known to be a signal. */
  readSignal(signal: S): unknown;

  /** Write a new value into a signal cell. */
  writeSignal(signal: S, value: unknown): void;

  /** Create a computed cell recomputed from the cells fn reads. */
  createComputed(fn: () => unknown): S;

  /** Read a computed cell. Benchmarks mix signals and computeds in the same
   * dependency rows, so readComputed must also accept signal cells;
   * readSignal exists separately for frameworks with a cheaper signal-only
   * read path. */
  readComputed(cell: S): unknown;

  /** Create an effect that re-runs when the cells fn reads change.
   *
   * This is the auto-tracking effect shape: one body that both reads cells
   * and performs its side effect. Frameworks whose effects are natively a
   * (compute, reaction) pair have to emulate this shape with a shim (for
   * example, an always-fire equality and a no-op reaction); those adapters
   * also implement effectPair below, and benchmarks additionally measure
   * them through it in their natural shape.
   *
   * fn must return undefined: several frameworks treat a returned value as a
   * cleanup handle, so benchmarks pass block-bodied callbacks and adapters
   * may hand fn to the framework without a protective wrapper closure. */
  effect(fn: () => void): void;

  /** Create an effect expressed as a (compute, reaction) pair.
   *
   * compute runs tracked: the cells it reads become the effect's
   * dependencies, and it returns a value. reaction performs the side effect
   * with that value, runs untracked, and must not read reactive cells.
   * The framework's own change detection decides delivery: reaction runs
   * when compute's result is a new value.
   *
   * Optional on purpose. Only adapters whose framework natively separates
   * the tracked compute from the untracked reaction — a (compute, reaction)
   * effect signature, a reaction()-style primitive, or a value-delivering
   * subscription on a computed — implement this. Auto-tracking frameworks
   * whose users would fuse both halves into one effect body already have
   * that workload measured by effect() above, so they leave this undefined
   * and the suite drivers skip the pair variant for them.
   *
   * Reaction-count parity with the tracked style holds only when compute's
   * value changes on every run: benchmarks that assert reaction counts must
   * arrange for compute to return a fresh value on every write they count.
   *
   * Whether reaction runs at creation time (and whether that first run is
   * synchronous) is framework-defined, so benchmarks reset their counters
   * after graph construction. */
  effectPair?(compute: () => unknown, reaction: (value: unknown) => void): void;

  withBatch(fn: () => void): void;
  withBuild<T>(fn: () => T): T;
  cleanup(): void;
}
