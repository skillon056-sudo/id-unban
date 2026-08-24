import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ── Admin bootstrap ──────────────────────────────────────────
  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "ChangeMe_123!";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.admin.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });
  console.log(`Admin ready: ${email}`);

  // ── Settings ─────────────────────────────────────────────────
  const settings: Record<string, string> = {
    site_name: process.env.NEXT_PUBLIC_SITE_NAME || "FF ID Recovery",
    unban_price: process.env.UNBAN_PRICE || "199",
    currency: process.env.PAYMENT_CURRENCY || "INR",
    usd_rate: "83", // INR per 1 USD — used to show prices in $ on the site
    support_contact: "support@example.com",
    maintenance_mode: "false",
    default_status: "BANNED",
    payment_enabled: "true",
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: {}, // don't overwrite admin-edited values on re-seed
      create: { key, value },
    });
  }
  console.log("Settings ready");

  // ── Fictional test IDs (no real accounts) ────────────────────
  const ids = [
    { gameId: "100000001", status: "BANNED", banReason: "Suspicious activity detected", unbanEnabled: true },
    { gameId: "100000002", status: "BANNED", banReason: "Use of third-party software", unbanEnabled: true },
    { gameId: "100000003", status: "UNBANNED", banReason: null, unbanEnabled: false },
    { gameId: "100000004", status: "PENDING", banReason: "Under manual review", unbanEnabled: false },
    { gameId: "100000005", status: "BANNED", banReason: "Chat abuse report", unbanEnabled: false, notes: "Repeat offender" },
  ];
  for (const rec of ids) {
    await prisma.freeFireId.upsert({
      where: { gameId: rec.gameId },
      update: {},
      create: rec,
    });
  }
  console.log(`Seeded ${ids.length} test IDs`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
