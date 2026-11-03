"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone } from "@/lib/availability";
import { cleanInstagram } from "@/lib/profileLinks";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function saveSettings(prevState, formData) {
  const businessName = String(formData.get("business_name") || "").trim();
  const slug = String(formData.get("slug") || "").trim().toLowerCase();
  const timezone = String(formData.get("timezone") || "").trim();
  const tagline = String(formData.get("tagline") || "").trim();

  if (!businessName) return { error: "Please enter your business name." };
  if (businessName.length > 100) return { error: "Business name is too long." };
  if (slug.length < 3 || slug.length > 40 || !SLUG_PATTERN.test(slug)) {
    return {
      error:
        "Your link can use lowercase letters, numbers and single dashes (3 to 40 characters), like cuts-by-sam.",
    };
  }
  if (!isValidTimeZone(timezone)) return { error: "Please pick your time zone." };
  if (tagline.length > 120) return { error: "Please keep the tagline to 120 characters." };

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

  // Saved on its own, so the rest still saves before the tagline SQL is run.
  const { error: taglineError } = await supabase
    .from("stylists")
    .update({ tagline })
    .eq("id", user.id);
  if (taglineError) {
    revalidatePath("/dashboard", "layout");
    return {
      error:
        "Your other settings were saved, but not the tagline. Run supabase/migrations/0013_tagline.sql in Supabase first.",
    };
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
  const regularsOnly = formData.get("regulars_only") === "on";
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
    .update({ auto_regular_after: after, regulars_only: regularsOnly })
    .eq("id", user.id);
  if (error) return { error: error.message };

  // Apply the new number straight away.
  const { data: promoted } = await supabase.rpc("refresh_my_regulars");

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/clients");
  const notes = [];
  if (regularsOnly) notes.push("Only Regulars (and invited clients) can book online.");
  if (after === 0) notes.push("You'll pick your Regulars by hand.");
  else if (promoted > 0) {
    notes.push(`${promoted} ${promoted === 1 ? "client is" : "clients are"} now Regulars.`);
  }
  return { success: ["Saved.", ...notes].join(" ") };
}

// ---------- Your business: cover photo, Instagram, location ----------

// The message for a failed save. Before the step 10 SQL is run, the columns
// don't exist yet (42703 from Postgres, PGRST204 from Supabase's API).
function saveError(error) {
  if (error.code === "42703" || error.code === "PGRST204") {
    return "Run supabase/migrations/0014_cover_and_links.sql in Supabase first, then try again.";
  }
  return error.message;
}

// The public link a file in the stylist's own folder of the "covers" bucket gets.
function coverPrefix(userId) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${userId}/`;
}

// Deletes the stylist's older cover photos, keeping `keepPath` (if any).
async function removeOldCovers(supabase, userId, keepPath) {
  const { data: files } = await supabase.storage.from("covers").list(userId, { limit: 100 });
  const old = (files || [])
    .map((file) => `${userId}/${file.name}`)
    .filter((path) => path !== keepPath);
  if (old.length) await supabase.storage.from("covers").remove(old);
}

// Called after the browser has uploaded the photo to Storage.
export async function saveCoverPhoto(url) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };

  const link = String(url || "");
  const prefix = coverPrefix(user.id);
  const fileName = link.slice(prefix.length);
  if (!link.startsWith(prefix) || !/^[A-Za-z0-9._-]+$/.test(fileName) || link.length > 500) {
    return { error: "That photo didn't upload properly. Please try again." };
  }

  const { error } = await supabase
    .from("stylists")
    .update({ cover_photo_url: link })
    .eq("id", user.id);
  if (error) return { error: saveError(error) };

  await removeOldCovers(supabase, user.id, `${user.id}/${fileName}`);
  revalidatePath("/dashboard/settings");
  revalidatePath("/book", "layout");
  return { success: "Cover photo saved. It's on your booking page now." };
}

export async function removeCoverPhoto() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };

  const { error } = await supabase
    .from("stylists")
    .update({ cover_photo_url: "" })
    .eq("id", user.id);
  if (error) return { error: saveError(error) };

  await removeOldCovers(supabase, user.id, null);
  revalidatePath("/dashboard/settings");
  revalidatePath("/book", "layout");
  return { success: "Cover photo removed." };
}

export async function saveBusinessLinks(prevState, formData) {
  const instagram = cleanInstagram(formData.get("instagram"));
  const location = String(formData.get("location") || "").trim();

  if (instagram === null) {
    return { error: "Please enter your Instagram name, like @cutsbysam, or leave it empty." };
  }
  if (location.length > 200) return { error: "Please keep the location to 200 characters." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };

  const { error } = await supabase
    .from("stylists")
    .update({ instagram, location })
    .eq("id", user.id);
  if (error) return { error: saveError(error) };

  revalidatePath("/dashboard/settings");
  revalidatePath("/book", "layout");
  return { success: "Saved." };
}
