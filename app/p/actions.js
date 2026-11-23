"use server";

// Report a review on a public profile (step 58 SQL). Anyone can report;
// the Clientele team decides in the Control Room.
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORT_REASONS } from "@/lib/reviews";

export async function reportReview(prev, formData) {
  const id = String(formData.get("id") || "");
  const reason = String(formData.get("reason") || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Something went wrong. Please try again." };
  if (!REPORT_REASONS.some(([k]) => k === reason)) return { error: "Please choose a reason." };
  const details = String(formData.get("details") || "").trim().slice(0, 1000) || null;
  const reporter = String(formData.get("email") || "").trim().slice(0, 200) || null;

  const admin = createAdminClient();
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const { data: ok } = await admin.rpc("rate_ok", { p_bucket: `review-report:${ip}`, p_max: 10, p_window: "1 hour" });
  if (ok === false) return { error: "Too many reports. Please try again later." };

  // Only a review that's actually public can be reported.
  const { data: review } = await admin
    .from("visit_feedback")
    .select("booking_id, stylist_id, is_public, hidden")
    .eq("booking_id", id)
    .maybeSingle();
  if (!review || !review.is_public || review.hidden) return { error: "That review isn't showing any more." };
  const { error } = await admin.from("review_reports").insert({ booking_id: id, stylist_id: review.stylist_id, reason, details, reporter });
  if (error) return { error: "Couldn't send. Please try again." };
  return { success: "Thanks. The Clientele team will look at it." };
}
