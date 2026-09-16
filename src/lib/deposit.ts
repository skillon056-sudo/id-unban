// How long after the service payment clears before the deposit step opens.
// Measured from the settled payment on the server, so a refresh, a new tab or
// typing the deposit URL directly can neither restart nor skip it.
export const DEPOSIT_DELAY_MS = 15 * 60 * 1000;

/**
 * When the deposit step opens. The wait can be switched off in Settings, in
 * which case it opens the moment the payment clears. Unset means on, so the
 * behaviour doesn't change until someone turns it off.
 */
export function depositOpensAt(paidAt: Date, settings: Record<string, string>) {
  const delay = settings.deposit_delay_enabled === "false" ? 0 : DEPOSIT_DELAY_MS;
  return new Date(paidAt.getTime() + delay);
}
