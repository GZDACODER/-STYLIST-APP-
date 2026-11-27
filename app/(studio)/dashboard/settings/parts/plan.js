// Settings section: Plan (server component).
import { getUser } from "@/lib/supabase/user";
import { createClient } from "@/lib/supabase/server";
import { paymentsConfigured } from "@/lib/stripe";
import { getMyPlan } from "@/lib/plan";
import PlanCard from "../PlanCard";
import { extraChairCount } from "@/lib/shopsServer";

export async function PlanSection({ billing }) {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;
  const plan = await getMyPlan(supabase, user.id);
  if (!plan.ready) return <p className="muted">Plans aren&apos;t set up yet.</p>;
  const extraChairs = await extraChairCount(user.id).catch(() => 0);
  return (
    <PlanCard
      plan={plan}
      billingNotice={billing}
      canPay={paymentsConfigured()}
      assistantAvailable={Boolean(process.env.ANTHROPIC_API_KEY)}
      extraChairs={extraChairs}
    />
  );
}
