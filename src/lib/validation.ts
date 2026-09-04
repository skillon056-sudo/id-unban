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
  banDuration: z.string().trim().max(100).optional().nullable(),
  unbanEnabled: z.boolean().default(true),
  freeUnban: z.boolean().optional(),
  otp: z.string().trim().max(20).optional().nullable(),
  price: z.number().int().min(1).max(1_000_000).nullable().optional(),
  unbanLeft: z.number().int().min(0).max(1_000_000).nullable().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const idUpdateSchema = idInputSchema.partial().extend({
  // gameId is immutable-ish but allow edits; still validate format if present.
  gameId: gameIdSchema.optional(),
});

// Intake for a paid appeal-assistance case.
export const appealIntakeSchema = z.object({
  gameId: gameIdSchema,
  contactEmail: z
    .string({ required_error: "Please enter your email address." })
    .trim()
    .email("Enter a valid email address."),
  contactPhone: z.string().trim().max(20).optional().or(z.literal("")),
  details: z.string().trim().max(2000).optional().or(z.literal("")),
});

// UPI handles look like name@bank — letters, digits, dot/dash/underscore.
export const upiIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{2,64}@[a-z]{2,32}$/, "Enter a valid UPI ID, like name@bank.");

export const depositIntakeSchema = z.object({
  orderId: z.string().trim().min(6).max(40),
  upiId: upiIdSchema,
});

export const refundUpdateSchema = z.object({
  status: z.enum(["NOT_REQUESTED", "PENDING", "PROCESSING", "COMPLETED", "FAILED"]).optional(),
  reference: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const caseUpdateSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "FILED", "CLOSED", "REJECTED"]).optional(),
  adminNotes: z.string().trim().max(4000).optional().nullable(),
});

export const createPaymentSchema = z.object({
  gameId: gameIdSchema,
  otp: z.string().trim().max(20).optional(),
});

export const settingsSchema = z.object({
  site_name: z.string().trim().min(1).max(120).optional(),
  unban_price: z.string().regex(/^\d+$/).optional(),
  currency: z.string().trim().min(1).max(8).optional(),
  usd_rate: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  support_contact: z.string().trim().max(200).optional(),
  maintenance_mode: z.enum(["true", "false"]).optional(),
  default_status: z.enum(ID_STATUSES).optional(),
  payment_enabled: z.enum(["true", "false"]).optional(),
  unknown_reason: z.string().trim().max(120).optional(),
  deposit_amount: z.string().regex(/^\d+$/).optional(),
  default_unban_left: z.string().regex(/^\d+$/).optional(),
  result_note: z.string().trim().max(500).optional(),
  deposit_enabled: z.enum(["true", "false"]).optional(),
  deposit_terms: z.string().trim().max(4000).optional(),
  deposit_terms_en: z.string().trim().max(4000).optional(),
  fee_note: z.string().trim().max(600).optional(),
  site_logo: z.string().trim().max(500).optional(),
  videos_heading: z.string().trim().max(60).optional(),
  video_1_url: z.string().trim().max(200).optional(),
  video_1_title: z.string().trim().max(150).optional(),
  video_1_duration: z.string().trim().max(10).optional(),
  video_2_url: z.string().trim().max(200).optional(),
  video_2_title: z.string().trim().max(150).optional(),
  video_2_duration: z.string().trim().max(10).optional(),
  video_3_url: z.string().trim().max(200).optional(),
  video_3_title: z.string().trim().max(150).optional(),
  video_3_duration: z.string().trim().max(10).optional(),
  cta_label: z.string().trim().max(40).optional(),
  service_free: z.enum(["true", "false"]).optional(),
  service_fee: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  service_fee_before: z.string().regex(/^\d*(\.\d+)?$/).optional(),
  default_price_usd: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  // Background-image slots — a local /uploads path or a full URL, or "" to clear.
  img_page_bg: z.string().trim().max(500).optional(),
  img_hero_bg: z.string().trim().max(500).optional(),
  img_banner_top: z.string().trim().max(500).optional(),
  img_banner_mid: z.string().trim().max(500).optional(),
  img_section_bg: z.string().trim().max(500).optional(),
  img_faq_bg: z.string().trim().max(500).optional(),
  img_footer_bg: z.string().trim().max(500).optional(),
});
