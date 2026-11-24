"use server";

// Packages (step 68 SQL): sell a bundle of prepaid sessions to a client.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_LOCKED, isDemo } from "@/lib/demo";
import { METHODS } from "@/lib/moneyTab";
import { todayInTimeZone } from "@/lib/availability";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function sellPackage(prev, formData) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const { data: c } = await supabase.from("clients").select("id, name").eq("id", String(formData.get("client_id") || "")).maybeSingle();
  if (!c) return { error: "Choose who it's for." };
  const name = String(formData.get("name") || "").trim().slice(0, 100);
  const sessions = Math.round(Number(formData.get("sessions")));
  const price = Math.round(Number(String(formData.get("price") || "0").replace(/[$,\s]/g, "")) * 100);
  if (!name) return { error: "Give the package a name." };
  if (!(sessions >= 1 && sessions <= 200)) return { error: "Sessions should be 1 to 200." };
  if (!(price >= 0)) return { error: "Check the price." };
  const method = String(formData.get("method") || "");
  const serviceId = String(formData.get("service_id") || "");
  const expires = String(formData.get("expires_on") || "");
  const { data: s } = await supabase.from("stylists").select("timezone").eq("id", user.id).maybeSingle();
  const { error } = await supabase.from("client_packages").insert({
    stylist_id: user.id,
    client_id: c.id,
    client_name: c.name,
    name,
    sessions_total: sessions,
    price_cents: price,
    paid_method: METHODS.some(([k]) => k === method) ? method : null,
    service_id: /^[0-9a-f-]{36}$/i.test(serviceId) ? serviceId : null,
    purchased_on: todayInTimeZone(s?.timezone || "America/Chicago"),
    expires_on: /^\d{4}-\d{2}-\d{2}$/.test(expires) ? expires : null,
    note: String(formData.get("note") || "").trim().slice(0, 300) || null,
  });
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath("/dashboard/packages");
  return { success: `Sold ${name} to ${c.name}. Sessions are counted automatically as they happen.`, at: Date.now() };
}

export async function voidPackage(formData) {
  const { supabase, user } = await me();
  if (!user || isDemo(user)) return;
  await supabase.from("client_packages").update({ status: "void" }).eq("id", String(formData.get("id"))).eq("stylist_id", user.id);
  revalidatePath("/dashboard/packages");
}
