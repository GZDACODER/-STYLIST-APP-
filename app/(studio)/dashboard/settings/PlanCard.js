// Settings: the stylist's plan (All-in), team members, and paying with Stripe.
import { PLANS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import ChoosePlanForm from "./ChoosePlanForm";
import TeamMembersForm from "./TeamMembersForm";
import AssistantAddOn from "./AssistantAddOn";

const NOTICES = {
  success: { kind: "success", text: "Thanks! Your plan is being switched on. Refresh in a moment if it still says Paused." },
  cancelled: { kind: "info", text: "Payment cancelled. Nothing was charged." },
  portal_error: { kind: "error", text: "Stripe's billing page didn't open. Please try again in a minute." },
};

const day = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;

const daysText = (n) => (n <= 1 ? "less than a day" : `${n} days`);

// assistantAvailable: the Assistant is switched on for this app (its API key is set).
// extraChairs: other chairs in the shop this pro owns (added to the plan).
export default function PlanCard({ plan, billingNotice, canPay, assistantAvailable = false, extraChairs = 0 }) {
  const notice = NOTICES[billingNotice];
  const yearly = plan.interval === "year";
  const per = yearly ? "/yr" : "/mo";
  const planCents = yearly ? PLANS.allin.yearlyCents : PLANS.allin.monthlyCents;
  const seatCents = yearly ? PLANS.team.yearlyCents : PLANS.team.monthlyCents;
  const chairCents = yearly ? PLANS.chair.yearlyCents : PLANS.chair.monthlyCents;
  const assistantCents = yearly ? PLANS.assistant.yearlyCents : PLANS.assistant.monthlyCents;
  const on = plan.has.base;

  return (
    <section className="card" id="plan">
      {notice && <p className={`message ${notice.kind}`}>{notice.text}</p>}

      <div className="plan-line">
        <div>
          <strong>
            {PLANS.allin.name} · {formatPrice(PLANS.allin.monthlyCents)}/mo
          </strong>
          <span className="muted small-text"> or {formatPrice(PLANS.allin.yearlyCents)}/yr</span>
          <p className="muted small-text">{PLANS.allin.description}</p>
        </div>
        <span className={on ? "badge paid" : "badge"}>{on ? "On" : "Paused"}</span>
      </div>

      {plan.shopCovered ? (
        <p className="muted">
          <strong>Your shop pays for your plan.</strong> Everything stays on while you&apos;re a chair in the shop, and
          you&apos;re never billed. See <a href="/dashboard/shop">Shop</a>.
        </p>
      ) : plan.comped ? (
        <p className="muted">
          Founding account: your plan is free and you&apos;re never billed for it.
          {assistantAvailable && " The Assistant add-on is the one thing that's paid."}
        </p>
      ) : plan.subscribed && plan.cancelling ? (
        <>
          <p className="message info">
            <strong>Your plan ends on {day(plan.cancelAt)}.</strong> You won&apos;t be charged. Everything stays
            on until then.
          </p>
          <p>
            <a href="/dashboard/billing/portal" className="button small">
              Reactivate
            </a>
          </p>
          <p className="muted small-text">Reactivate opens Stripe&apos;s billing page, where you can renew your plan.</p>
        </>
      ) : plan.subscribed ? (
        <>
          <p className="muted">
            {plan.stripeStatus === "past_due"
              ? "Your last payment didn't go through. Stripe will try again; please check your card in Manage billing."
              : plan.stripeStatus === "trialing"
                ? `Free trial: ${daysText(plan.daysLeft)} left. Your plan starts on ${day(plan.trialEndsAt)}.`
                : `Paid ${yearly ? "yearly" : "monthly"}. Next renewal ${day(plan.periodEnd)}.`}
          </p>
          <dl className="plan-sum">
            <div>
              <dt>{PLANS.allin.name}</dt>
              <dd>
                {formatPrice(planCents)}
                {per}
              </dd>
            </div>
            {plan.teamMembers > 0 && (
            <div>
              <dt>
                Team members × {plan.teamMembers}
              </dt>
              <dd>
                {formatPrice(plan.teamMembers * seatCents)}
                {per}
              </dd>
            </div>
            )}
            {plan.shopChairs > 0 && (
              <div>
                <dt>Extra chairs × {plan.shopChairs}</dt>
                <dd>
                  {formatPrice(plan.shopChairs * chairCents)}
                  {per}
                </dd>
              </div>
            )}
            {plan.assistantPaid && (
              <div>
                <dt>{PLANS.assistant.name}</dt>
                <dd>
                  {formatPrice(assistantCents)}
                  {per}
                </dd>
              </div>
            )}
            <div className="plan-sum-total">
              <dt>Total</dt>
              <dd>
                {formatPrice(planCents + plan.teamMembers * seatCents + plan.shopChairs * chairCents + (plan.assistantPaid ? assistantCents : 0))}
                {per}
              </dd>
            </div>
          </dl>
          <p className="muted small-text">
            If you signed up on an earlier plan, Stripe keeps your original price; Manage billing shows it.
          </p>
          {canPay && plan.teamMembers > 0 && <TeamMembersForm key={plan.teamMembers} count={plan.teamMembers} yearly={yearly} />}
        </>
      ) : plan.stripeStatus === "canceled" ? (
        <p className="muted">
          <strong>No active plan.</strong>{" "}
          {plan.inTrial
            ? `Your free trial keeps everything on until ${day(plan.trialEndsAt)}. Choose a plan below to keep it going after that.`
            : "Choose a plan below to switch everything back on. Your bookings and clients are all still here."}
        </p>
      ) : plan.inTrial ? (
        <p className="muted">
          <strong>Free trial: {daysText(plan.daysLeft)} left.</strong> Everything is on until{" "}
          {day(plan.trialEndsAt)}, and no card is needed. Choose your plan below to keep it going
          after that.
        </p>
      ) : (
        <p className="muted">
          Your free trial has ended. Choose your plan to switch everything back on. Your bookings
          and clients are all still here.
        </p>
      )}

      {assistantAvailable && <AssistantAddOn plan={plan} canPay={canPay} />}

      {plan.hasCustomer && (plan.subscribed || !plan.comped) && !(plan.subscribed && plan.cancelling) && (
        <p>
          <a href="/dashboard/billing/portal" className="button secondary small">
            Manage billing
          </a>
        </p>
      )}

      {!plan.comped && !plan.subscribed && !plan.shopCovered &&
        (canPay ? (
          <ChoosePlanForm inTrial={plan.inTrial} assistantAvailable={assistantAvailable} extraChairs={extraChairs} />
        ) : (
          <p className="message warning">Paying isn&apos;t set up yet (the Stripe keys are missing in Vercel).</p>
        ))}

      <p className="muted small-text">
        <a href="/dashboard/feedback">Share feedback</a> about Clientele: what&apos;s working, what isn&apos;t, what
        would help.
      </p>
      <p className="muted small-text">
        Run a shop? Each other chair is {formatPrice(PLANS.chair.monthlyCents)}/mo on your plan, with its own booking page,
        calendar and payouts. <a href="/dashboard/shop">Start a shop</a>
      </p>
    </section>
  );
}
