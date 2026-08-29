let counter = 0;

/**
 * Deterministic-ish IDs — we want stable ordering during a single session.
 * Prefer `crypto.randomUUID()` when it's cheap; fall back to a monotonic counter
 * so that snapshot tests remain diffable.
 */
export function nextId(prefix: string): string {
  counter += 1;
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  const uuid = g.crypto?.randomUUID
    ? g.crypto.randomUUID().slice(0, 8)
    : Math.random().toString(16).slice(2, 10);
  return `${prefix}_${counter.toString(36)}_${uuid}`;
}

/**
 * Cheap deterministic hash (djb2) — good enough for schema-hash inclusion in
 * evidence bundles; not for cryptographic use.
 */
export function djb2(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h) ^ input.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, "0");
}
