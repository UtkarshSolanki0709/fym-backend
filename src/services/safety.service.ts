import { supabase } from "../libs/supabaseClient.js";
import { AppError } from "../middleware/errorHandler.middleware.js";

async function assertProfileExists(profileId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .maybeSingle();
  if (!data) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
}

export async function submitReport(
  reporterId: string,
  body: {
    target_id: string;
    room_id?: string;
    reasons: string[];
    notes?: string;
    agreement_version: string;
  },
) {
  if (reporterId === body.target_id) {
    throw new AppError(400, "SELF_REPORT", "Cannot report yourself");
  }
  await assertProfileExists(body.target_id);

  const { data, error } = await supabase
    .from("report_tickets")
    .insert({
      reporter_id: reporterId,
      target_id: body.target_id,
      room_id: body.room_id ?? null,
      reasons: body.reasons,
      // canonical live-schema columns (DPDP artifacts)
      reporter_notes: body.notes ?? null,
      consent_given_at: new Date().toISOString(),
      agreement_version: body.agreement_version,
      status: "open",
    })
    .select("id, status, created_at")
    .single();
  if (error) throw new AppError(500, "REPORT_FAILED", error.message);
  return data;
}

export async function blockUser(blockerId: string, targetId: string) {
  if (blockerId === targetId) {
    throw new AppError(400, "SELF_BLOCK", "Cannot block yourself");
  }
  await assertProfileExists(targetId);

  const { error } = await supabase
    .from("blocks")
    .upsert(
      { blocker_id: blockerId, blocked_id: targetId },
      { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true },
    );
  if (error) throw new AppError(500, "BLOCK_FAILED", error.message);
  return { ok: true, blocked: targetId };
}

export async function submitGrievance(
  reporterId: string,
  body: {
    category: string;
    description: string;
    contact_email?: string;
    target_id?: string;
  },
) {
  const { data, error } = await supabase
    .from("grievance_tickets")
    .insert({
      reporter_id: reporterId,
      target_id: body.target_id ?? null,
      category: body.category,
      description: body.description,
      contact_email: body.contact_email ?? null,
      status: "open",
    })
    .select("id, status, created_at")
    .single();
  if (error) throw new AppError(500, "GRIEVANCE_FAILED", error.message);
  return data;
}
