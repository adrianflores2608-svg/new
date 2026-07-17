/**
 * Runs `fn` over `items` with at most `limit` in flight at once, instead of
 * either fully sequential (slow) or fully parallel (can blow through API
 * rate limits). Used for polling multiple wallets and scoring multiple
 * ranking candidates.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}
