"use server";

// The pro's Requests inbox: approve (emails a booking link only that
// client can use, for the service chosen) or decline (with a note).
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { publicSiteUrl } from "@/lib/siteUrl";
import { isDemo, DEMO_LOCKED } from "@/lib/demo";

async function myRequest(id) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  // Row security: only the pro's own requests come back.
  const { data: rq } = await supabase.from("booking_requests").select("*").eq("id", String(id)).maybeSingle();
  if (!rq) return { error: "That request isn't here any more." };
  const { data: s } = await supabase.from("stylists").select("slug, business_name").eq("id", user.id).maybeSingle();
  return { user, rq, s, supabase };
}

export async function approveRequest(prev, formData) {
  const { error, user, rq, s, supabase } = await myRequest(formData.get("id"));
  if (error) return { error };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  if (rq.status !== "new" && rq.status !== "declined") return { error: "This request has already been answered." };
  const serviceId = String(formData.get("service_id") || rq.service_id || "");
  const { data: svc } = await supabase.from("services").select("id, name").eq("id", serviceId).maybeSingle();
  if (!svc) return { error: "Please choose what they can book." };
  const note = String(formData.get("note") || "").trim().slice(0, 1000);
  const token = randomBytes(24).toString("hex");
  const { error: upError } = await createAdminClient()
    .from("booking_requests")
    .update({ status: "approved", approved_service_id: svc.id, token, decided_at: new Date().toISOString(), pro_note: note || null })
    .eq("id", rq.id);
  if (upError) return { error: "Couldn't save. Please try again." };
  const link = `${publicSiteUrl("https://www.clientelesuite.com")}/book/${s.slug}?request=${token}`;
  if (emailConfigured()) {
    await sendEmails([
      {
        to: rq.client_email,
        subject: `${s.business_name} approved your request`,
        html: emailLayout("Your request was approved", [
          `<p>Hi ${escapeHtml(rq.client_name.split(" ")[0])},</p>`,
          `<p>Good news: ${escapeHtml(s.business_name)} approved your ${escapeHtml(rq.service_name)} request. Book your <strong>${escapeHtml(svc.name)}</strong> with the button below; this link is just for you.</p>`,
          note ? `<p style="margin:18px 0;padding:14px 16px;background:#f3eee5;border-left:3px solid #a8874d;white-space:pre-line;">${escapeHtml(note)}</p>` : "",
          `<p>${emailButton(link, `Book your ${svc.name}`)}</p>`,
        ]),
        text: `${s.business_name} approved your ${rq.service_name} request.${note ? `\n\n${note}` : ""}\n\nBook your ${svc.name}: ${link}`,
      },
    ]).catch(() => {});
  }
  revalidatePath("/dashboard/requests");
  return { success: `Approved. ${rq.client_name} has been emailed a link to book.`, link };
}

export async function declineRequest(prev, formData) {
  const { error, user, rq, s } = await myRequest(formData.get("id"));
  if (error) return { error };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  if (rq.status !== "new") return { error: "This request has already been answered." };
  const note = String(formData.get("note") || "").trim().slice(0, 1000);
  await createAdminClient()
    .from("booking_requests")
    .update({ status: "declined", decided_at: new Date().toISOString(), pro_note: note || null })
    .eq("id", rq.id);
  if (emailConfigured()) {
    await sendEmails([
      {
        to: rq.client_email,
        subject: `About your request to ${s.business_name}`,
        html: emailLayout("About your request", [
          `<p>Hi ${escapeHtml(rq.client_name.split(" ")[0])},</p>`,
          `<p>Thanks for your ${escapeHtml(rq.service_name)} request. ${escapeHtml(s.business_name)} isn't able to take it on right now.</p>`,
          note ? `<p style="margin:18px 0;padding:14px 16px;background:#f3eee5;border-left:3px solid #a8874d;white-space:pre-line;">${escapeHtml(note)}</p>` : "",
        ]),
        text: `Thanks for your ${rq.service_name} request. ${s.business_name} isn't able to take it on right now.${note ? `\n\n${note}` : ""}`,
      },
    ]).catch(() => {});
  }
  revalidatePath("/dashboard/requests");
  return { success: "Declined. They've been emailed." };
}

export async function setRequestFirst(formData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || isDemo(user)) return;
  await supabase
    .from("services")
    .update({ request_first: formData.get("on") === "true" })
    .eq("id", String(formData.get("id")))
    .eq("stylist_id", user.id);
  revalidatePath("/dashboard/services");
}
