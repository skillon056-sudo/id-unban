import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  // No session -> this is the /admin/login route (middleware blocks the rest).
  // Render it bare, without the dashboard shell.
  if (!session) return <>{children}</>;
  return <AdminShell email={session.email}>{children}</AdminShell>;
}
