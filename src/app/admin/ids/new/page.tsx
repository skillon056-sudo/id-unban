"use client";

import { useRouter } from "next/navigation";
import { IdForm } from "@/components/admin/IdForm";

export default function NewIdPage() {
  const router = useRouter();
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold">Add Free Fire ID</h1>
      <p className="mt-1 text-sm text-muted">Create a new record in the database.</p>
      <div className="card mt-6 p-6">
        <IdForm onSaved={() => router.push("/admin/ids")} onCancel={() => router.push("/admin/ids")} />
      </div>
    </div>
  );
}
