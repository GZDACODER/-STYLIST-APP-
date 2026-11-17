"use server";

// Trial feedback: save it (step 38 SQL) and email it to the owner
// (ADMIN_EMAILS). The email is best-effort; the answers are always saved.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyPlan } from "@/lib/plan";
import { adminEmails } from "@/lib/admin";
import { emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { KEEP_USING, RATINGS } from "./questions";

const clip = (v, n) => String(v || "").trim().slice(0, n);

export async function submitFeedback(prevState, formData) {
  const rating = Number(formData.get("rating"));
  const keepUsing = String(formData.get("keep_using") || "");
  const needsUpdate = clip(formData.get("needs_update"), 2000);
  const easier = clip(formData.get("easier"), 2000);
  const notes = clip(formData.get("notes"), 4000);

  if (!RATINGS.some((r) => r.value === rating)) return { error: "Please pick how Clientele is working for you (1 to 5)." };
  if (keepUsing && !KEEP_USING.some((k) => k.value === keepUsing)) return { error: "Please pick one of the options." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };

  const plan = await getMyPlan(supabase, user.id);
  const trialDay = plan.inTrial ? Math.max(1, 15 - (plan.daysLeft || 14)) : null;

  const { error } = await supabase.from("trial_feedback").insert({
    stylist_id: user.id,
    rating,
    keep_using: keepUsing || null,
    needs_update: needsUpdate || null,
    easier: easier || null,
    notes: notes || null,
    trial_day: trialDay,
  });
  if (error) {
    if (/trial_feedback/.test(error.message)) {
      return { error: "Feedback isn't set up yet. Run supabase/migrations/0043_trial_feedback.sql in Supabase first." };
    }
    return { error: error.message };
  }

  // Tell the owner (best-effort).
  const to = adminEmails();
  if (to.length && emailConfigured()) {
    try {
      const { data: stylist } = await supabase.from("stylists").select("business_name").eq("id", user.id).maybeSingle();
      const business = stylist?.business_name || "A pro";
      const ratingText = `${rating}/5 (${RATINGS.find((r) => r.value === rating).label})`;
      const keepText = KEEP_USING.find((k) => k.value === keepUsing)?.label || "Not answered";
      const rows = [
        ["Business", `${business} (${user.email})`],
        ["Trial day", trialDay ? `Day ${trialDay} of 14` : "Not in trial"],
        ["Overall", ratingText],
        ["Keep using after the trial?", keepText],
        ["What needs updating", needsUpdate || "—"],
        ["What would make their life easier", easier || "—"],
        ["Notes", notes || "—"],
      ];
      await sendEmails(
        to.map((address) => ({
          to: address,
          subject: `Trial feedback from ${business}: ${rating}/5`,
          replyTo: user.email,
          html: emailLayout(
            "New trial feedback",
            rows.map(([k, v]) => `<p><strong>${escapeHtml(k)}</strong><br>${escapeHtml(v).replace(/\n/g, "<br>")}</p>`)
          ),
          text: rows.map(([k, v]) => `${k}: ${v}`).join("\n\n"),
        }))
      );
    } catch (e) {
      console.error("Couldn't email trial feedback", e);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/feedback");
  return { success: "Thank you! Your feedback goes straight to the Clientele team.", sentAt: Date.now() };
}
