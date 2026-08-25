import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  BANNED: "bg-red-50 text-red-700 border-red-200",
  UNBANNED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  "REVIEW REQUIRED": "bg-amber-50 text-amber-700 border-amber-200",
  SUCCESS: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
  CREATED: "bg-sky-50 text-sky-700 border-sky-200",
  SUBMITTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide",
        styles[status] || "bg-slate-100 text-slate-600 border-slate-200",
      )}
    >
      {status}
    </span>
  );
}
