"use server";

// Email all pros (Admin > Email all pros): from hello@clientelesuite.com,
// replies to the owner. "Send me a test" goes only to the owner first.
// Each pro who gets it is recorded in admin_actions (0074).
import { getUser } from "@/lib/supabase/user";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { announceFooter, audienceOf, AUDIENCES } from "@/lib/announce";
import { loadProsAdmin } from "../pros/data";
import { siteBase } from "../launch/data";

const html = (p) =>
  `<p>${escapeHtml(p).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#7d6232;">$1</a>').replace(/\n/g, "<br>")}</p>`;

function message(to, subject, body, firstName) {
  const hello = firstName ? `Hi ${firstName},` : "Hi,";
  const paras = [hello, ...body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)];
  const foot = announceFooter(siteBase());
  return {
    to,
    subject,
    html: emailLayout(subject, [...paras.map(html), `<p style="color:#8a8378;font-size:12px;">${escapeHtml(foot)}</p>`]),
    text: [...paras, "", foot].join("\n\n"),
    replyTo: (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim() || undefined,
  };
}

export async function sendAnnouncement(prev, formData) {
  const user = await getUser();
  if (!user || !isAdmin(user)) return { error: "Only the owner can do this." };
  if (!emailConfigured()) return { error: "Email isn't set up on this site." };
  const subject = String(formData.get("subject") || "").trim().slice(0, 150);
  const body = String(formData.get("body") || "").trim().slice(0, 8000);
  const audience = String(formData.get("audience") || "all");
  const test = formData.get("mode") === "test";
  if (!subject || !body) return { error: "Add a subject and a message." };
  if (!AUDIENCES.some((a) => a.key === audience)) return { error: "Pick who it's for." };

  if (test) {
    const [r] = await sendEmails([message(user.email, `[Test] ${subject}`, body, "")]);
    return r?.ok ? { success: `Test sent to ${user.email}. Check it, then send it for real.`, tested: true } : { error: `It didn't send: ${r?.error || "unknown error"}` };
  }

  const { pros, error } = await loadProsAdmin();
  if (error) return { error: `Couldn't load pros: ${error.message}` };
  const to = audienceOf(pros, audience);
  if (!to.length) return { error: "Nobody in that group (test, paused and opted-out accounts are left out)." };
  const results = await sendEmails(to.map((p) => message(p.email, subject, body, p.firstName)));
  const sent = to.filter((_, i) => results[i]?.ok);
  if (sent.length) {
    await createAdminClient()
      .from("admin_actions")
      .insert(sent.map((p) => ({ stylist_id: p.id, business_name: p.businessName, admin_email: user.email, action: "announce", detail: `Email to all pros: "${subject}"` })));
  }
  const failed = to.length - sent.length;
  return { success: `Sent to ${sent.length} ${sent.length === 1 ? "pro" : "pros"}${failed ? `; ${failed} didn't go` : ""}.`, done: true };
}
