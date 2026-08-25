export const ID_STATUSES = ["BANNED", "UNBANNED", "PENDING"] as const;
export type IdStatus = (typeof ID_STATUSES)[number];

export const PAYMENT_STATES = [
  "CREATED",
  "PENDING",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export const REQUEST_STATES = ["PENDING", "SUBMITTED", "REJECTED"] as const;
export type RequestState = (typeof REQUEST_STATES)[number];

// Public-facing view of an ID lookup — never leaks notes/internal fields.
export interface PublicIdResult {
  gameId: string;
  status: IdStatus;
  known: boolean; // false = no custom admin record; default config was used
  banReason: string | null; // assistance category / ban reason
  banDuration: string | null; // review period / ban duration
  unbanEnabled: boolean;
  free: boolean; // unban is free — no payment, direct success
  price: number; // effective unban fee in INR (charged by the gateway)
  priceUsd: number; // same fee converted to USD (shown on the site)
  currency: string;
  unbanLeft: number | null; // "Unban Left: N times" (null = don't show)
  note: string; // admin-editable note under the result ("" = hide)
}
