"use client";

import { StatusBadge } from "./StatusBadge";
import { formatMoney } from "@/lib/utils";

export interface PaymentInfo {
  orderId: string;
  gameId: string;
  amount: number;
  currency: string;
  status: string;
  transactionId?: string | null;
  requestStatus?: string;
}

export function PaymentSummary({ info }: { info: PaymentInfo }) {
  return (
    <div className="mt-6 grid gap-3 text-sm">
      <Row label="Order ID" value={info.orderId} mono />
      <Row label="Free Fire ID" value={info.gameId} mono />
      <Row label="Amount" value={formatMoney(info.amount, info.currency)} />
      {info.transactionId && <Row label="Transaction ID" value={info.transactionId} mono />}
      <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
        <span className="text-muted">Payment status</span>
        <StatusBadge status={info.status} />
      </div>
      {info.requestStatus && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted">Request status</span>
          <StatusBadge status={info.requestStatus} />
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-3">
      <span className="text-muted">{label}</span>
      <span className={mono ? "text-right font-mono text-ink" : "text-right font-medium text-ink"}>
        {value}
      </span>
    </div>
  );
}
