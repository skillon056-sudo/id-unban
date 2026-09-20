// Splits one withdrawal into several smaller payouts.
//
// The gateway's UPI channel is happier with modest amounts than one large one,
// so a big withdrawal goes out as a handful of chunks. Every chunk must land
// inside [min, max] — including the last one, which is where a naive loop goes
// wrong: it takes what it likes and leaves a remainder that is too small to
// send. So each step leaves at least `min` behind for the rest.
//
// Chunks are rounded to ₹100 to look like ordinary transfers rather than
// arithmetic leftovers; the final chunk absorbs whatever rounding left over.

export interface SplitOptions {
  min?: number;
  max?: number;
  /** Injected in tests so the split is reproducible. */
  random?: () => number;
}

export function splitAmount(total: number, opts: SplitOptions = {}): number[] {
  const min = opts.min ?? 2000;
  const max = opts.max ?? 5000;
  const rand = opts.random ?? Math.random;

  if (!Number.isInteger(total) || total <= 0) throw new Error("Enter a whole amount.");
  if (min < 1 || max < min) throw new Error("Chunk range is invalid.");
  if (total < min) throw new Error(`Amount must be at least ₹${min}.`);

  const chunks: number[] = [];
  let rest = total;

  while (rest > max) {
    // Never take so much that the remainder drops below one whole chunk.
    const hi = Math.min(max, rest - min);
    if (hi < min) {
      // Only possible when rest sits just above max: halve it instead.
      const half = Math.floor(rest / 2);
      chunks.push(half);
      rest -= half;
      break;
    }
    // Round the pick to ₹100, then clamp back inside the window.
    const raw = min + rand() * (hi - min);
    const chunk = Math.min(hi, Math.max(min, Math.round(raw / 100) * 100));
    chunks.push(chunk);
    rest -= chunk;
  }

  chunks.push(rest);
  return chunks;
}
