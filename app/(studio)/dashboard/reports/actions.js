"use server";

// Insights > Overdue clients: "Invite back" emails a client a link to book
// again (at most once every 30 days per client).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_LOCKED, isDemo } from "@/lib/demo";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { publicSiteUrl } from "@/lib/siteUrl";
import { swapWords, templateFor } from "@/lib/templates";

export async function inviteBack(prev, formData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  // A client card, or (for a booking not linked to one) the booking's email.
  let c = null;
  const clientId = String(formData.get("id") || "");
  if (clientId) {
    const { data } = await supabase.from("clients").select("id, name, email, invited_back_at").eq("id", clientId).maybeSingle();
    c = data;
  } else {
    const { data: b } = await supabase.from("bookings").select("client_name, client_email").eq("id", String(formData.get("booking_id") || "")).maybeSingle();
    if (b) c = { id: null, name: b.client_name, email: b.client_email };
  }
  if (!c?.email) return { error: "There's no email for this client." };
  if (c.invited_back_at && Date.now() - new Date(c.invited_back_at).getTime() < 30 * 86400000)
    return { error: "You invited them back in the last 30 days." };
  if (!c.id) {
    const { data: ok } = await createAdminClient().rpc("rate_ok", { p_bucket: `invite-back:${user.id}:${c.email.toLowerCase()}`, p_max: 1, p_window: "30 days" });
    if (ok === false) return { error: "You invited them back in the last 30 days." };
  }
  const { data: s } = await supabase.from("stylists").select("slug, business_name, reply_email, business_type, modules").eq("id", user.id).maybeSingle();
  if (!emailConfigured()) return { error: "Email isn't set up yet." };
  const words = templateFor(s.business_type, s.modules).words;
  const serviceId = String(formData.get("service_id") || "");
  const link = `${publicSiteUrl("https://www.clientelesuite.com")}/book/${s.slug}${/^[0-9a-f-]{36}$/i.test(serviceId) ? `?service=${serviceId}` : ""}`;
  const first = String(c.name || "").split(" ")[0];
  const note = String(formData.get("note") || "").trim().slice(0, 500);
  await sendEmails([
    {
      to: c.email,
      subject: `${s.business_name} would love to see you again`,
      ...(s.reply_email ? { replyTo: s.reply_email } : {}),
      html: emailLayout("It's been a while", [
        `<p>Hi ${escapeHtml(first)},</p>`,
        `<p>${escapeHtml(swapWords(`It's been a while since your last visit with ${s.business_name}, and we'd love to see you again. Pick a time that suits you:`, words))}</p>`,
        note ? `<p style="margin:18px 0;padding:14px 16px;background:#f3eee5;border-left:3px solid #a8874d;white-space:pre-line;">${escapeHtml(note)}</p>` : "",
        `<p>${emailButton(link, "Book again")}</p>`,
      ]),
      text: `Hi ${first}, ${swapWords(`it's been a while since your last visit with ${s.business_name}`, words)}, and we'd love to see you again.${note ? `\n\n${note}` : ""}\n\nBook again: ${link}`,
    },
  ]).catch(() => {});
  if (c.id) await supabase.from("clients").update({ invited_back_at: new Date().toISOString() }).eq("id", c.id);
  revalidatePath("/dashboard/reports");
  return { success: `Invited. ${first} has been emailed a link to book.` };
}
