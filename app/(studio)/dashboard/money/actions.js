"use server";

// Money (step 62 SQL): record payments, mark balances paid, remind clients.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_LOCKED, isDemo } from "@/lib/demo";
import { KINDS, METHODS } from "@/lib/moneyTab";
import { todayInTimeZone } from "@/lib/availability";
import { emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { formatPrice } from "@/lib/money";
import { formatDate } from "@/lib/availability";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const cents = (text) => {
  const n = Number(String(text || "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

export async function addPayment(prev, formData) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const kind = String(formData.get("kind"));
  const method = String(formData.get("method"));
  const amount = cents(formData.get("amount"));
  if (!KINDS.some(([k]) => k === kind)) return { error: "Choose what it's for." };
  if (!METHODS.some(([k]) => k === method)) return { error: "Choose how they paid." };
  if (!(amount > 0) || amount > 10000000) return { error: "Enter an amount, like 40 or 12.50." };
  const { data: s } = await supabase.from("stylists").select("timezone").eq("id", user.id).maybeSingle();
  const paidOn = /^\d{4}-\d{2}-\d{2}$/.test(String(formData.get("paid_on"))) ? String(formData.get("paid_on")) : todayInTimeZone(s?.timezone || "America/Chicago");
  const clientId = String(formData.get("client_id") || "");
  let clientName = String(formData.get("client_name") || "").trim().slice(0, 100) || null;
  let client_id = null;
  if (/^[0-9a-f-]{36}$/i.test(clientId)) {
    const { data: c } = await supabase.from("clients").select("id, name").eq("id", clientId).maybeSingle();
    if (c) {
      client_id = c.id;
      clientName = c.name;
    }
  }
  const { error } = await supabase.from("payments").insert({
    stylist_id: user.id,
    client_id,
    client_name: clientName,
    kind,
    method,
    amount_cents: amount,
    paid_on: paidOn,
    note: String(formData.get("note") || "").trim().slice(0, 300) || null,
  });
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath("/dashboard/money");
  return { success: `Saved ${formatPrice(amount)}.`, savedAt: Date.now() };
}

export async function deletePayment(formData) {
  const { supabase, user } = await me();
  if (!user || isDemo(user)) return;
  await supabase.from("payments").delete().eq("id", String(formData.get("id"))).eq("stylist_id", user.id);
  revalidatePath("/dashboard/money");
}

export async function markBalancePaid(prev, formData) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const method = String(formData.get("method"));
  if (!METHODS.some(([k]) => k === method)) return { error: "Choose how they paid." };
  const amount = cents(formData.get("amount"));
  if (!(amount > 0)) return { error: "Enter the amount they paid." };
  const { data: b } = await supabase.from("bookings").select("id, client_id, client_name").eq("id", String(formData.get("id"))).maybeSingle();
  if (!b) return { error: "That visit isn't there any more." };
  const { data: s } = await supabase.from("stylists").select("timezone").eq("id", user.id).maybeSingle();
  const { error } = await supabase.from("payments").insert({
    stylist_id: user.id,
    booking_id: b.id,
    client_id: b.client_id,
    client_name: b.client_name,
    kind: "balance",
    method,
    amount_cents: amount,
    paid_on: todayInTimeZone(s?.timezone || "America/Chicago"),
  });
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath("/dashboard/money");
  return { success: "Marked paid." };
}

export async function remindBalance(prev, formData) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const { data: b } = await supabase
    .from("bookings")
    .select("id, client_name, client_email, service_name, booking_date, balance_reminded_at")
    .eq("id", String(formData.get("id")))
    .maybeSingle();
  if (!b?.client_email) return { error: "There's no email for this client." };
  if (b.balance_reminded_at && Date.now() - new Date(b.balance_reminded_at).getTime() < 3 * 86400000)
    return { error: "You sent a reminder recently. You can send another in a few days." };
  const amount = Number(formData.get("owed")) || 0;
  const { data: s } = await supabase.from("stylists").select("business_name, reply_email").eq("id", user.id).maybeSingle();
  if (!emailConfigured()) return { error: "Email isn't set up yet." };
  const first = String(b.client_name || "").split(" ")[0];
  await sendEmails([
    {
      to: b.client_email,
      subject: `A friendly reminder from ${s.business_name}`,
      ...(s.reply_email ? { replyTo: s.reply_email } : {}),
      html: emailLayout("A friendly reminder", [
        `<p>Hi ${escapeHtml(first)},</p>`,
        `<p>Just a reminder that there's a balance of <strong>${escapeHtml(formatPrice(amount))}</strong> from your ${escapeHtml(b.service_name)} on ${escapeHtml(formatDate(b.booking_date))}.</p>`,
        `<p>You can pay at your next visit, or reply to this email to sort it out. Thank you!</p>`,
        `<p>${escapeHtml(s.business_name)}</p>`,
      ]),
      text: `Hi ${first}, just a reminder that there's a balance of ${formatPrice(amount)} from your ${b.service_name} on ${formatDate(b.booking_date)}. You can pay at your next visit, or reply to this email. Thank you! ${s.business_name}`,
    },
  ]).catch(() => {});
  await supabase.from("bookings").update({ balance_reminded_at: new Date().toISOString() }).eq("id", b.id);
  revalidatePath("/dashboard/money");
  return { success: "Reminder sent." };
}
