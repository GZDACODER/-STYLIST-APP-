"use server";

// Report a review on a public profile (step 58 SQL). Anyone can report;
// the Clientele team decides in the Control Room.
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORT_REASONS } from "@/lib/reviews";
import { createBookingClient } from "@/lib/supabase/booking";
import { confirmFollowing, startFollowing } from "@/lib/followers";
import { isDemoSlug } from "@/lib/demo";

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

// ---------- "Notify me" (step 60 SQL) ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function publicPro(handle) {
  const { data } = await createAdminClient()
    .from("stylists")
    .select("id, slug, business_name, profile_on")
    .eq("handle", String(handle || "").toLowerCase())
    .maybeSingle();
  return data?.profile_on ? data : null;
}

export async function followPro(prev, formData) {
  const stylist = await publicPro(formData.get("handle"));
  if (!stylist) return { error: "This profile isn't available." };
  if (isDemoSlug(stylist.slug)) return { error: "This is a demo profile, so alerts are switched off." };
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  if (!name) return { error: "Please add your name." };
  if (!EMAIL_RE.test(email) || email.length > 200) return { error: "Please check your email address." };
  const wants = String(formData.get("wants") || "any");
  const days = formData.getAll("days");
  const parts = formData.getAll("parts");
  const serviceIds = formData.getAll("services");
  if (wants === "times" && !days.length && !parts.length) return { error: "Pick at least one day or time of day." };
  if (wants === "services" && !serviceIds.length) return { error: "Pick at least one service." };

  const admin = createAdminClient();
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const { data: ok } = await admin.rpc("rate_ok", { p_bucket: `follow:${ip}`, p_max: 10, p_window: "1 hour" });
  if (ok === false) return { error: "Too many tries. Please try again later." };

  // Someone who already confirmed their email to book here skips the code.
  let verifiedEmail = null;
  try {
    const { data: page } = await (await createBookingClient()).rpc("get_booking_page", { p_slug: stylist.slug });
    verifiedEmail = page?.viewer_email || null;
  } catch {
    verifiedEmail = null;
  }
  const r = await startFollowing({
    stylist,
    name,
    email,
    phone: formData.get("phone"),
    wants,
    days,
    parts,
    serviceIds,
    verifiedEmail,
  });
  if (r.error) return { error: r.error };
  return r.needCode ? { step: "code", id: r.id, email } : { done: true };
}

export async function confirmFollow(prev, formData) {
  const stylist = await publicPro(formData.get("handle"));
  if (!stylist) return { error: "This profile isn't available.", step: "code", id: formData.get("id") };
  const r = await confirmFollowing({ id: formData.get("id"), stylistId: stylist.id, code: formData.get("code") });
  if (r.error) return { error: r.error, step: "code", id: formData.get("id"), email: formData.get("email") };
  return { done: true };
}
