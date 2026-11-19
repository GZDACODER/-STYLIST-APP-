// Settings section: Regulars (server component).
import { getMyPlan } from "@/lib/plan";
import RegularsForm from "../RegularsForm";
import PausedNote from "@/components/PausedNote";
import RegularStar from "@/components/RegularStar";
import { me, optional } from "./common";

export async function RegularsSection() {
  const { supabase, user, row } = await me("auto_regular_after, regulars_only");
  if (!user) return null;
  const plan = await getMyPlan(supabase, user.id);
  return (
    <section className="card">
      <p className="muted">
        <RegularStar label={null} size={12} /> Regulars see your &quot;Regulars only&quot; openings. Clients are
        matched by their phone number and confirm with an email code.
      </p>
      {!plan.has.regulars && (
        <PausedNote feature="regulars">Your plan is paused, so Regulars-only mode is off.</PausedNote>
      )}
      <RegularsForm
        autoRegularAfter={row.auto_regular_after}
        regularsOnly={row.regulars_only}
        regularsOnlyAllowed={plan.has.regulars}
      />
    </section>
  );
}

// Asks Stripe whether the stylist's account can receive deposits yet, and
// saves the answer. (Only Stripe can say so, which is why stylists can't edit it.)
async function refreshStripeStatus(userId, accountId, savedEnabled) {
  try {
    const account = await getStripe().v2.core.accounts.retrieve(accountId, {
      include: ["configuration.recipient", "requirements"],
    });
    const transfers = account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers;
    const enabled = transfers?.status === "active";
    // Finished = Stripe isn't waiting on anything more from the stylist.
    const detailsSubmitted = !(account.requirements?.entries || []).some(
      (entry) => entry.awaiting_action_from === "user"
    );
    if (enabled !== savedEnabled) {
      await createAdminClient().from("stylists").update({ stripe_charges_enabled: enabled }).eq("id", userId);
    }
    return { enabled, detailsSubmitted };
  } catch (error) {
    console.error("Couldn't check Stripe account", error);
    return { enabled: savedEnabled, detailsSubmitted: savedEnabled };
  }
}
