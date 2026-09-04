import { z } from "zod";

export const REPORT_REASONS = [
  "Inappropriate photos",
  "Harassment or abuse",
  "Fake profile / catfish",
  "Spam or scam",
  "Underage user",
  "Off-platform solicitation",
  "Other",
] as const;

export const GRIEVANCE_CATEGORIES = [
  "Account or login issue",
  "Report follow-up",
  "Privacy / data request",
  "Billing question",
  "Other",
] as const;

export const reportSchema = z.object({
  target_id: z.string().uuid(),
  room_id: z.string().uuid().optional(),
  reasons: z.array(z.enum(REPORT_REASONS)).min(1).max(4),
  notes: z.string().max(1000).optional(),
  /** DPDP Act artifact — client sends the version of the consent text shown */
  agreement_version: z.string().min(1).max(20).default("v1"),
});

export const blockSchema = z.object({
  target_id: z.string().uuid(),
});

export const grievanceSchema = z.object({
  category: z.enum(GRIEVANCE_CATEGORIES).default("Other"),
  description: z.string().min(10).max(2000),
  contact_email: z.string().email().optional(),
  target_id: z.string().uuid().optional(),
});
