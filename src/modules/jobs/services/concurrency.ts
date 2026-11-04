/**
 * Concurrency Execution Utilities for JobNexus Aggregation Engine.
 * Bounded worker pools prevent socket exhaustion, upstream rate-limiting (429),
 * and libuv thread pool starvation.
 */

export async function executeWithConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  concurrencyLimit = 8
): Promise<T[]> {
  if (tasks.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrencyLimit, tasks.length));
  const results: T[] = new Array(tasks.length);
  let currentIndex = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (currentIndex < tasks.length) {
      const taskIndex = currentIndex++;
      results[taskIndex] = await tasks[taskIndex]();
    }
  });

  await Promise.all(workers);
  return results;
}

export async function executeSettledWithConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  concurrencyLimit = 6
): Promise<PromiseSettledResult<T>[]> {
  if (tasks.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrencyLimit, tasks.length));
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let currentIndex = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (currentIndex < tasks.length) {
      const taskIndex = currentIndex++;
      try {
        const value = await tasks[taskIndex]();
        results[taskIndex] = { status: 'fulfilled', value };
      } catch (reason) {
        results[taskIndex] = { status: 'rejected', reason };
      }
    }
  });

  await Promise.all(workers);
  return results;
}

