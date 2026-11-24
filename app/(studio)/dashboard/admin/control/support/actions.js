"use server";

// Changes the Clientele team makes with a pro's support access (edit level
// only). Each one is checked, logged and emailed to the pro.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { logSupport, supportAllowed } from "@/lib/support";
import { formatPrice } from "@/lib/money";

async function guard(stylistId) {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user || !isAdmin(user)) return "Not allowed.";
  if (!/^[0-9a-f-]{36}$/i.test(String(stylistId))) return "Not allowed.";
  if (!(await supportAllowed(stylistId, "edit"))) return "Edit access is off for this account.";
  return null;
}

export async function supportEditService(prev, formData) {
  const stylistId = String(formData.get("stylist_id"));
  const problem = await guard(stylistId);
  if (problem) return { error: problem };
  const admin = createAdminClient();
  const { data: svc } = await admin.from("services").select("id, name, price_cents, duration_minutes").eq("id", String(formData.get("id"))).eq("stylist_id", stylistId).maybeSingle();
  if (!svc) return { error: "That service isn't there." };
  const name = String(formData.get("name") || "").trim().slice(0, 100);
  const price = Math.round(Number(String(formData.get("price")).replace(/[$,]/g, "")) * 100);
  const minutes = Number(formData.get("minutes"));
  if (!name || !(price >= 0) || !(minutes >= 5 && minutes <= 960)) return { error: "Check the name, price and length." };
  const changes = [];
  if (name !== svc.name) changes.push(`name "${svc.name}" → "${name}"`);
  if (price !== svc.price_cents) changes.push(`price ${formatPrice(svc.price_cents)} → ${formatPrice(price)}`);
  if (minutes !== svc.duration_minutes) changes.push(`length ${svc.duration_minutes} → ${minutes} min`);
  if (!changes.length) return { success: "Nothing changed." };
  const { error } = await admin.from("services").update({ name, price_cents: price, duration_minutes: minutes }).eq("id", svc.id);
  if (error) return { error: error.message };
  await logSupport({ stylistId, action: `Changed the service "${svc.name}"`, detail: changes.join("; "), level: "edit" });
  revalidatePath(`/dashboard/admin/control/support/${stylistId}`);
  return { success: `Saved and emailed the pro: ${changes.join("; ")}.` };
}

export async function supportEditTagline(prev, formData) {
  const stylistId = String(formData.get("stylist_id"));
  const problem = await guard(stylistId);
  if (problem) return { error: problem };
  const admin = createAdminClient();
  const { data: s } = await admin.from("stylists").select("tagline").eq("id", stylistId).maybeSingle();
  const tagline = String(formData.get("tagline") || "").trim().slice(0, 120);
  if ((s?.tagline || "") === tagline) return { success: "Nothing changed." };
  await admin.from("stylists").update({ tagline }).eq("id", stylistId);
  await logSupport({ stylistId, action: "Changed the booking page tagline", detail: `"${s?.tagline || ""}" → "${tagline}"`, level: "edit" });
  revalidatePath(`/dashboard/admin/control/support/${stylistId}`);
  return { success: "Saved and emailed the pro." };
}
