"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone } from "@/lib/availability";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function saveSettings(prevState, formData) {
  const businessName = String(formData.get("business_name") || "").trim();
  const slug = String(formData.get("slug") || "").trim().toLowerCase();
  const timezone = String(formData.get("timezone") || "").trim();

  if (!businessName) return { error: "Please enter your business name." };
  if (businessName.length > 100) return { error: "Business name is too long." };
  if (slug.length < 3 || slug.length > 40 || !SLUG_PATTERN.test(slug)) {
    return {
      error:
        "Your link can use lowercase letters, numbers and single dashes (3 to 40 characters), like cuts-by-sam.",
    };
  }
  if (!isValidTimeZone(timezone)) return { error: "Please pick your time zone." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };

  const { error } = await supabase
    .from("stylists")
    .update({ business_name: businessName, slug, timezone })
    .eq("id", user.id);

  if (error) {
    // 23505 = "unique violation": another stylist already has this link.
    if (error.code === "23505") return { error: "That link is already taken. Try another." };
    return { error: error.message };
  }

  // Name, link and time zone show up across the whole dashboard.
  revalidatePath("/dashboard", "layout");
  return { success: "Settings saved." };
}

const DEPOSIT_TYPES = ["none", "fixed", "percent"];

export async function saveDeposits(prevState, formData) {
  const enabled = formData.get("deposits_enabled") === "on";
  const policy = String(formData.get("cancellation_policy") || "").trim();
  if (policy.length > 2000) return { error: "The cancellation policy is too long (2,000 characters max)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };

  const [{ data: stylist }, { data: services, error: servicesError }] = await Promise.all([
    supabase.from("stylists").select("stripe_charges_enabled").eq("id", user.id).maybeSingle(),
    supabase.from("services").select("id, name, price_cents"),
  ]);
  if (servicesError) return { error: servicesError.message };
  if (enabled && !stylist?.stripe_charges_enabled) {
    return { error: "Connect your Stripe account first, then turn deposits on." };
  }

  // Check every service's deposit before saving anything.
  const updates = [];
  for (const service of services) {
    const type = String(formData.get(`deposit_type_${service.id}`) || "none");
    if (!DEPOSIT_TYPES.includes(type)) return { error: "Please pick a deposit type." };

    const amountText = String(formData.get(`deposit_amount_${service.id}`) || "").trim();
    const amount = Number(amountText);
    let depositAmount = 0;

    if (type === "fixed") {
      if (!amountText || !Number.isFinite(amount) || amount < 0.5) {
        return { error: `${service.name}: the deposit must be at least $0.50.` };
      }
      // Stored in cents, like prices.
      depositAmount = Math.round(amount * 100);
      if (depositAmount > service.price_cents) {
        return { error: `${service.name}: the deposit can't be more than the price.` };
      }
    } else if (type === "percent") {
      if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
        return { error: `${service.name}: the percent must be a whole number from 1 to 100.` };
      }
      depositAmount = amount;
    }
    updates.push({ id: service.id, deposit_type: type, deposit_amount: depositAmount });
  }

  const results = await Promise.all([
    supabase
      .from("stylists")
      .update({ deposits_enabled: enabled, cancellation_policy: policy })
      .eq("id", user.id),
    ...updates.map(({ id, ...values }) => supabase.from("services").update(values).eq("id", id)),
  ]);
  const failed = results.find((r) => r.error);
  if (failed) return { error: failed.error.message };

  revalidatePath("/dashboard/settings");
  if (!enabled) return { success: "Saved. Deposits are off, so clients book without paying." };
  if (!updates.some((u) => u.deposit_type !== "none")) {
    return { success: "Saved. Deposits are on, but no service has a deposit yet." };
  }
  return { success: "Saved. Clients now pay a deposit when they book." };
}

export async function saveRegulars(prevState, formData) {
  const after = Number(formData.get("auto_regular_after"));
  if (!Number.isInteger(after) || after < 0 || after > 50) {
    return { error: "Please pick a number of appointments." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };

  const { error } = await supabase
    .from("stylists")
    .update({ auto_regular_after: after })
    .eq("id", user.id);
  if (error) return { error: error.message };

  // Apply the new number straight away.
  const { data: promoted } = await supabase.rpc("refresh_my_regulars");

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/clients");
  if (after === 0) return { success: "Saved. You'll pick your Regulars by hand." };
  if (promoted > 0) {
    return {
      success: `Saved. ${promoted} ${promoted === 1 ? "client is" : "clients are"} now Regulars.`,
    };
  }
  return { success: "Saved." };
}
