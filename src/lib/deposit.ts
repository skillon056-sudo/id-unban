// How long after the service payment clears before the deposit step opens.
// Measured from the settled payment on the server, so a refresh, a new tab or
// typing the deposit URL directly can neither restart nor skip it.
export const DEPOSIT_DELAY_MS = 15 * 60 * 1000;

export const depositOpensAt = (paidAt: Date) =>
  new Date(paidAt.getTime() + DEPOSIT_DELAY_MS);
