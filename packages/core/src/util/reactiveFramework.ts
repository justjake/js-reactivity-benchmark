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
   * fn must return undefined: several frameworks treat a returned value as a
   * cleanup handle, so benchmarks pass block-bodied callbacks and adapters
   * may hand fn to the framework without a protective wrapper closure. */
  effect(fn: () => void): void;

  withBatch(fn: () => void): void;
  withBuild<T>(fn: () => T): T;
  cleanup(): void;
}
