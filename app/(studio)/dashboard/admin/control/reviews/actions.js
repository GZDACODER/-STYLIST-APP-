"use server";

// Control Room > Reviews: hide a reported review, or keep it.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";

export async function decideReport(formData) {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user || !isAdmin(user)) return;
  const id = String(formData.get("id") || "");
  const decision = formData.get("decision") === "hide" ? "hidden" : "kept";
  const admin = createAdminClient();
  const { data: rep } = await admin.from("review_reports").select("booking_id, stylist_id").eq("id", id).maybeSingle();
  if (!rep) return;
  await admin.from("visit_feedback").update({ hidden: decision === "hidden" }).eq("booking_id", rep.booking_id);
  // Every open report on that review is settled together.
  await admin
    .from("review_reports")
    .update({ status: decision, decided_at: new Date().toISOString() })
    .eq("booking_id", rep.booking_id)
    .eq("status", "open");
  const { data: s } = await admin.from("stylists").select("handle").eq("id", rep.stylist_id).maybeSingle();
  if (s?.handle) {
    revalidatePath(`/p/${s.handle}`);
    revalidatePath(`/p/${s.handle}/reviews`);
  }
  revalidatePath("/dashboard/admin/control/reviews");
}
