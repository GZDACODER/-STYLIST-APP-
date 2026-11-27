"use server";

// Launch week: send a pro their next-step note from hello@clientelesuite.com
// (EMAIL_FROM), with replies going to the owner (first of ADMIN_EMAILS).
// Owner only. Recorded in admin_nudges (0073) so the page shows when.
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/user";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { noteParagraphs } from "@/lib/activation";
import { loadPros } from "./data";

const linkify = (text) =>
  escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#7d6232;">$1</a>')
    .replace(/\n/g, "<br>");

export async function sendNudge(prevState, formData) {
  const user = await getUser();
  if (!user || !isAdmin(user)) return { error: "Only the owner can send these." };
  if (!emailConfigured()) return { error: "Email isn't set up on this site." };

  const id = String(formData.get("id") || "");
  const { pros } = await loadPros();
  const p = pros.find((x) => x.id === id);
  if (!p || !p.email) return { error: "Couldn't find that pro's email." };

  const paras = noteParagraphs(p.note.body);
  const replyTo = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim() || undefined;
  const [result] = await sendEmails([
    {
      to: p.email,
      subject: p.note.subject,
      html: emailLayout(p.note.subject, paras.map((x) => `<p>${linkify(x)}</p>`)),
      text: paras.join("\n\n"),
      replyTo,
    },
  ]);
  if (!result?.ok) return { error: `It didn't send: ${result?.error || "unknown error"}` };

  await createAdminClient().from("admin_nudges").insert({ stylist_id: p.id, stage: p.stage, subject: p.note.subject });
  revalidatePath("/dashboard/admin/launch");
  return { success: `Sent to ${p.email}.` };
}
