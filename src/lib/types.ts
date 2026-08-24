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
  banReason: string | null;
  unbanEnabled: boolean;
}
