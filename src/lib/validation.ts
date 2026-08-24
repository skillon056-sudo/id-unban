import { z } from "zod";
import { ID_STATUSES } from "./types";

// Free Fire IDs are numeric, typically 8–12 digits.
export const gameIdSchema = z
  .string()
  .trim()
  .regex(/^\d{6,15}$/, "Enter a valid numeric Free Fire ID (6–15 digits).");

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const idInputSchema = z.object({
  gameId: gameIdSchema,
  status: z.enum(ID_STATUSES),
  banReason: z.string().trim().max(300).optional().nullable(),
  unbanEnabled: z.boolean().default(true),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const idUpdateSchema = idInputSchema.partial().extend({
  // gameId is immutable-ish but allow edits; still validate format if present.
  gameId: gameIdSchema.optional(),
});

export const createPaymentSchema = z.object({
  gameId: gameIdSchema,
});

export const settingsSchema = z.object({
  site_name: z.string().trim().min(1).max(120).optional(),
  unban_price: z.string().regex(/^\d+$/).optional(),
  currency: z.string().trim().min(1).max(8).optional(),
  support_contact: z.string().trim().max(200).optional(),
  maintenance_mode: z.enum(["true", "false"]).optional(),
  default_status: z.enum(ID_STATUSES).optional(),
  payment_enabled: z.enum(["true", "false"]).optional(),
  // Background-image slots — a local /uploads path or a full URL, or "" to clear.
  img_page_bg: z.string().trim().max(500).optional(),
  img_hero_bg: z.string().trim().max(500).optional(),
  img_banner_top: z.string().trim().max(500).optional(),
  img_banner_mid: z.string().trim().max(500).optional(),
  img_section_bg: z.string().trim().max(500).optional(),
  img_faq_bg: z.string().trim().max(500).optional(),
  img_footer_bg: z.string().trim().max(500).optional(),
});
