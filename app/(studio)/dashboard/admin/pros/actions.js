"use server";

// Admin actions on one pro's account (Pros > a pro). Owner only. Each one is
// written to admin_actions (0074) so the pro's page shows what was done.
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/user";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { extendTrialEnd, foundingTrialEnd } from "@/lib/adminPlan";

const EXTEND_DAYS = [7, 14, 30];

async function owner() {
  const user = await getUser();
  return user && isAdmin(user) ? user : null;
}

async function loadPro(admin, id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [{ data }, { data: plan }] = await Promise.all([
    admin.from("stylists").select("id, business_name, created_at").eq("id", id).maybeSingle(),
    admin.from("stylist_plans").select("trial_ends_at, comped, base_active").eq("stylist_id", id).maybeSingle(),
  ]);
  if (!data) return null;
  return { ...data, plan: plan || {} };
}

async function record(admin, user, pro, action, detail) {
  await admin.from("admin_actions").insert({ stylist_id: pro.id, business_name: pro.business_name, admin_email: user.email, action, detail });
  revalidatePath(`/dashboard/admin/pros/${pro.id}`);
  revalidatePath("/dashboard/admin/pros");
}

const fmt = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export async function makeFounding(prev, formData) {
  const user = await owner();
  if (!user) return { error: "Only the owner can do this." };
  const admin = createAdminClient();
  const pro = await loadPro(admin, String(formData.get("id") || ""));
  if (!pro) return { error: "Couldn't find that pro." };
  if (pro.plan.base_active) return { error: "They're already paying. Change it in Stripe instead." };
  const end = foundingTrialEnd(pro.created_at);
  const { error } = await admin.from("stylist_plans").update({ trial_ends_at: end, trial_reminder_sent_at: null }).eq("stylist_id", pro.id);
  if (error) return { error: error.message };
  await record(admin, user, pro, "founding", `Founding pro: free until ${fmt(end)}`);
  return { success: `Founding pro. Free until ${fmt(end)}.` };
}

export async function extendTrial(prev, formData) {
  const user = await owner();
  if (!user) return { error: "Only the owner can do this." };
  const days = Number(formData.get("days"));
  if (!EXTEND_DAYS.includes(days)) return { error: "Pick 7, 14 or 30 days." };
  const admin = createAdminClient();
  const pro = await loadPro(admin, String(formData.get("id") || ""));
  if (!pro) return { error: "Couldn't find that pro." };
  if (pro.plan.base_active) return { error: "They're already paying. Change it in Stripe instead." };
  const end = extendTrialEnd(pro.plan.trial_ends_at, Date.now(), days);
  const { error } = await admin.from("stylist_plans").update({ trial_ends_at: end, trial_reminder_sent_at: null }).eq("stylist_id", pro.id);
  if (error) return { error: error.message };
  await record(admin, user, pro, "extend", `${days} more free days, until ${fmt(end)}`);
  return { success: `Free until ${fmt(end)}.` };
}

export async function setFree(prev, formData) {
  const user = await owner();
  if (!user) return { error: "Only the owner can do this." };
  const on = formData.get("on") === "1";
  const admin = createAdminClient();
  const pro = await loadPro(admin, String(formData.get("id") || ""));
  if (!pro) return { error: "Couldn't find that pro." };
  const { error } = await admin.from("stylist_plans").update({ comped: on }).eq("stylist_id", pro.id);
  if (error) return { error: error.message };
  await record(admin, user, pro, on ? "free_on" : "free_off", on ? "Free account turned on (never pays)" : "Free account turned off");
  return { success: on ? "Free account on. They'll never be asked to pay." : "Free account off. Their trial or plan applies again." };
}

export async function emailPro(prev, formData) {
  const user = await owner();
  if (!user) return { error: "Only the owner can do this." };
  if (!emailConfigured()) return { error: "Email isn't set up on this site." };
  const subject = String(formData.get("subject") || "").trim().slice(0, 150);
  const body = String(formData.get("body") || "").trim().slice(0, 5000);
  if (!subject || !body) return { error: "Add a subject and a message." };
  const admin = createAdminClient();
  const pro = await loadPro(admin, String(formData.get("id") || ""));
  if (!pro) return { error: "Couldn't find that pro." };
  const { data: u } = await admin.auth.admin.getUserById(pro.id);
  const to = u?.user?.email;
  if (!to) return { error: "They have no email on file." };
  const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const replyTo = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim() || undefined;
  const [result] = await sendEmails([
    {
      to,
      subject,
      html: emailLayout(subject, paras.map((p) => `<p>${escapeHtml(p).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#7d6232;">$1</a>').replace(/\n/g, "<br>")}</p>`)),
      text: paras.join("\n\n"),
      replyTo,
    },
  ]);
  if (!result?.ok) return { error: `It didn't send: ${result?.error || "unknown error"}` };
  await record(admin, user, pro, "email", `Emailed "${subject}"`);
  return { success: `Sent to ${to}.` };
}

// Pause: their booking page says it's paused and no client can book
// (supabase/migrations/0075_pause_accounts.sql). Bookings they already have
// stay. Unpause puts everything back.
export async function setPaused(prev, formData) {
  const user = await owner();
  if (!user) return { error: "Only the owner can do this." };
  const on = formData.get("on") === "1";
  const reason = String(formData.get("reason") || "").trim().slice(0, 300);
  if (on && !reason) return { error: "Add a short reason (only you see it)." };
  const admin = createAdminClient();
  const pro = await loadPro(admin, String(formData.get("id") || ""));
  if (!pro) return { error: "Couldn't find that pro." };
  const { error } = await admin
    .from("stylists")
    .update(on ? { paused_at: new Date().toISOString(), paused_reason: reason } : { paused_at: null, paused_reason: "" })
    .eq("id", pro.id);
  if (error) return { error: error.message };
  await record(admin, user, pro, on ? "pause" : "unpause", on ? `Paused: ${reason}` : "Unpaused, taking bookings again");
  return { success: on ? "Paused. Their booking page is off and nobody can book." : "Unpaused. Clients can book again." };
}
