"use server";

// Signing the pro's waiver from a "Manage my appointment" link.
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOKEN_RE } from "@/lib/manageLink";
import { finishWaiver, signatureBytes, uploadSignature } from "@/lib/waivers";

const ERRORS = {
  answer_required: "Please answer the questions marked *.",
  answer_too_long: "One of your answers is too long.",
  signature_required: "Please type your name and sign in the box.",
  guardian_required: "Please type the parent or guardian's full name.",
  not_found: "This link doesn't work any more.",
};

export async function signWaiverByLink(token, form) {
  if (!TOKEN_RE.test(String(token))) return { error: ERRORS.not_found };
  const png = signatureBytes(form?.signature);
  const admin = createAdminClient();
  const { data: w } = await admin.rpc("waiver_for_visit", { p_token: String(token) });
  if (!w?.has_form) return { error: ERRORS.not_found };
  if (String(w.waiver_text || "").trim() && !png) return { error: ERRORS.signature_required };
  const signaturePath = png ? await uploadSignature(w.stylist_id, png) : null;
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || null;
  const userAgent = (h.get("user-agent") || "").slice(0, 300);
  const answers = {};
  for (const [k, v] of Object.entries(form?.answers || {})) answers[String(k).slice(0, 20)] = String(v ?? "").slice(0, 2000);
  const { data: id, error } = await admin.rpc("submit_waiver_for_visit", {
    p_token: String(token),
    p_answers: answers,
    p_signed_name: String(form?.signedName || ""),
    p_signature_path: signaturePath,
    p_for_minor: Boolean(form?.forMinor),
    p_guardian_name: form?.guardianName || null,
    p_guardian_relation: form?.guardianRelation || null,
    p_ip: ip,
    p_user_agent: userAgent,
  });
  if (error) {
    const code = Object.keys(ERRORS).find((c) => String(error.message).includes(c));
    return { error: ERRORS[code] || "Couldn't save. Please try again." };
  }
  const { data: r } = await admin.from("intake_responses").select("answers, waiver_text, signed_name, email").eq("id", id).maybeSingle();
  const { data: b } = await admin.from("bookings").select("stylist:stylists(business_name)").eq("cancel_token", String(token)).maybeSingle();
  if (png && r) {
    await finishWaiver({
      responseId: id,
      stylistId: w.stylist_id,
      businessName: b?.stylist?.business_name || "",
      signerName: r.signed_name || "",
      waiverText: r.waiver_text,
      answers: (r.answers || []).map((a) => ({ label: a.label, answer: a.answer })),
      forMinor: Boolean(form?.forMinor),
      guardianName: form?.guardianName,
      guardianRelation: form?.guardianRelation,
      signaturePath,
      png,
      ip,
      userAgent,
      email: r.email,
      bookingId: w.booking_id,
    }).catch((e) => console.error("Waiver PDF failed", e?.message));
  }
  return { success: true };
}
