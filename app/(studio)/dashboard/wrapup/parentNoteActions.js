"use server";

// Parent notes (step 68 SQL): a note after a session, emailed to the
// student's parent or guardian.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_LOCKED, isDemo } from "@/lib/demo";
import { emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { formatDate } from "@/lib/availability";
import { templateFor } from "@/lib/templates";

export async function saveParentNote(prev, formData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const id = String(formData.get("id"));
  const note = String(formData.get("note") || "").trim().slice(0, 1500);
  const send = formData.get("send") === "true";
  const { data: b } = await supabase
    .from("bookings")
    .select("id, client_id, client_name, service_name, booking_date, client:clients(guardian_name, guardian_email)")
    .eq("id", id)
    .maybeSingle();
  if (!b) return { error: "That session isn't there any more." };
  const { error } = await supabase.from("bookings").update({ parent_note: note || null }).eq("id", b.id);
  if (error) return { error: "Couldn't save. Please try again." };
  if (!send || !note) {
    revalidatePath("/dashboard/wrapup");
    return { success: "Saved." };
  }
  const to = b.client?.guardian_email;
  if (!to) return { success: "Saved. Add a parent's email on the student's card to send it." };
  if (!emailConfigured()) return { error: "Email isn't set up yet." };
  const { data: s } = await supabase.from("stylists").select("business_name, reply_email, business_type, modules").eq("id", user.id).maybeSingle();
  const W = templateFor(s?.business_type, s?.modules).words;
  const student = String(b.client_name || "").split(" ")[0];
  const when = formatDate(b.booking_date);
  const results = await sendEmails([
    {
      to,
      subject: `${student}'s ${W.visit} notes · ${when}`,
      ...(s?.reply_email ? { replyTo: s.reply_email } : {}),
      html: emailLayout(`${escapeHtml(student)}'s ${escapeHtml(W.visit)} notes`, [
        `<p>Hi ${escapeHtml(String(b.client?.guardian_name || "").split(" ")[0] || "there")},</p>`,
        `<p>Here's how ${escapeHtml(student)}'s ${escapeHtml(b.service_name)} went on ${escapeHtml(when)}:</p>`,
        `<p style="margin:18px 0;padding:14px 16px;background:#f3eee5;border-left:3px solid #a8874d;white-space:pre-line;">${escapeHtml(note)}</p>`,
        `<p>Questions? Just reply to this email.</p>`,
        `<p>${escapeHtml(s?.business_name || "")}</p>`,
      ]),
      text: `Here's how ${student}'s ${b.service_name} went on ${when}:\n\n${note}\n\nQuestions? Just reply to this email.\n${s?.business_name || ""}`,
    },
  ]);
  if (!results[0]?.ok) return { error: "Saved, but the email didn't send. Please try again." };
  await supabase.from("bookings").update({ parent_note: note }).eq("id", b.id);
  // Sent time is written by the server (not a column pros can set).
  const { createAdminClient } = await import("@/lib/supabase/admin");
  await createAdminClient().from("bookings").update({ parent_note_sent_at: new Date().toISOString() }).eq("id", b.id).eq("stylist_id", user.id);
  revalidatePath("/dashboard/wrapup");
  return { success: `Sent to ${b.client.guardian_name || to}.`, sent: true };
}
