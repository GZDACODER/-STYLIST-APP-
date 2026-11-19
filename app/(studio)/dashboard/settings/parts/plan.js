// Settings section: Plan (server component).
import { createClient } from "@/lib/supabase/server";
import { paymentsConfigured } from "@/lib/stripe";
import { getMyPlan } from "@/lib/plan";
import PlanCard from "../PlanCard";

export async function PlanSection({ billing }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const plan = await getMyPlan(supabase, user.id);
  if (!plan.ready) return <p className="muted">Plans aren&apos;t set up yet.</p>;
  return (
    <PlanCard
      plan={plan}
      billingNotice={billing}
      canPay={paymentsConfigured()}
      assistantAvailable={Boolean(process.env.ANTHROPIC_API_KEY)}
    />
  );
}
