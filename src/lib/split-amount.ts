// Splits one withdrawal into several smaller payouts.
//
// Rules the operator asked for, and the reasons they are awkward:
//   • every chunk inside [min, max] — including the LAST one, which is where a
//     naive loop fails: it takes what it likes and leaves a remainder too small
//     to send;
//   • no two chunks the same, and no two within `gap` of each other, so the
//     batch doesn't look like a repeated transfer;
//   • spread across the range rather than clustered.
//
// Those rules cap how much can go out at once: with a ₹200 gap between values
// in ₹2,000–₹5,000, there are only sixteen usable amounts, so a batch can hold
// at most sixteen payouts. Past that the amount genuinely cannot be split under
// these rules, and the caller is told rather than handed a batch that breaks
// them quietly.

export interface SplitOptions {
  min?: number;
  max?: number;
  /** Minimum difference between any two chunks. */
  gap?: number;
  /** Injected in tests so a split is reproducible. */
  random?: () => number;
}

export function splitAmount(total: number, opts: SplitOptions = {}): number[] {
  const min = opts.min ?? 2000;
  const max = opts.max ?? 5000;
  const gap = opts.gap ?? 200;
  const rand = opts.random ?? Math.random;

  if (!Number.isInteger(total) || total <= 0) throw new Error("Enter a whole amount.");
  if (max < min) throw new Error("Chunk range is invalid.");
  if (total < min) throw new Error(`Amount must be at least ₹${min}.`);

  // Odd rupees are added to the largest chunk at the end, so leave it room.
  const remainder = total % 100;
  const body = total - remainder;
  const ceiling = max - (remainder > 0 ? 100 : 0);

  // n chunks spaced `gap` apart can only cover a certain span: lowest possible
  // is min, min+gap, min+2*gap…; highest is max, max-gap, max-2*gap…
  const lowest = (n: number) => n * min + (gap * n * (n - 1)) / 2;
  const highest = (n: number) => n * ceiling - (gap * n * (n - 1)) / 2;

  const feasible: number[] = [];
  for (let n = 1; n <= Math.floor((ceiling - min) / gap) + 1; n++) {
    if (body >= lowest(n) && body <= highest(n)) feasible.push(n);
  }
  if (feasible.length === 0) {
    const most = Math.floor((ceiling - min) / gap) + 1;
    throw new Error(
      `₹${total.toLocaleString()} can't be split into different amounts of ₹${min}–₹${max} that stay ₹${gap} apart. The most that can go out at once is ₹${highest(most).toLocaleString()}.`,
    );
  }

  // Prefer a chunk count near the middle of the range, so amounts look ordinary.
  const ideal = body / ((min + ceiling) / 2);
  const n = feasible.reduce((a, b) => (Math.abs(b - ideal) < Math.abs(a - ideal) ? b : a));

  // Start at the lowest legal ladder, then raise from the top — raising the
  // largest first can never close the gap below it.
  const chunks: number[] = Array.from({ length: n }, (_, i) => min + gap * i);
  let rest = body - chunks.reduce((a, b) => a + b, 0);

  while (rest > 0) {
    let moved = false;
    for (let i = n - 1; i >= 0 && rest > 0; i--) {
      const ceilingHere = i === n - 1 ? ceiling : chunks[i + 1] - gap;
      const headroom = ceilingHere - chunks[i];
      if (headroom <= 0) continue;
      // Random-sized steps of ₹100 so the result isn't an obvious ladder.
      const step = Math.min(
        headroom,
        rest,
        Math.max(100, Math.round((rand() * headroom) / 100) * 100),
      );
      chunks[i] += step;
      rest -= step;
      moved = true;
    }
    if (!moved) break; // no headroom anywhere; the feasibility check prevents this
  }

  if (remainder > 0) chunks[n - 1] += remainder;

  // Shuffle so the batch isn't an ascending sequence.
  for (let i = chunks.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [chunks[i], chunks[j]] = [chunks[j], chunks[i]];
  }
  return chunks;
}
