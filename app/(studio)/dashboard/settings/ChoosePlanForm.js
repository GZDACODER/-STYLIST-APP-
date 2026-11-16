"use client";

// Choose the plan: All-in, monthly or yearly, plus any team members, then
// pay on Stripe. Team members can also be added later.
import { useActionState, useState } from "react";
import { startCheckout } from "./billingActions";
import { PLANS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function ChoosePlanForm({ inTrial }) {
  const [state, formAction] = useActionState(startCheckout, null);
  const [interval, setInterval] = useState("month");
  const [team, setTeam] = useState(0);

  const yearly = interval === "year";
  const plan = yearly ? PLANS.allin.yearlyCents : PLANS.allin.monthlyCents;
  const seat = yearly ? PLANS.team.yearlyCents : PLANS.team.monthlyCents;
  const per = yearly ? "/yr" : "/mo";

  return (
    <form action={formAction} className="choose-plan">
      <fieldset className="field">
        <legend>Billing</legend>
        <div className="segmented" role="group">
          {[
            ["month", "Monthly"],
            ["year", "Yearly (2 months free)"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`segment${interval === value ? " checked" : ""}`}
              aria-pressed={interval === value}
              onClick={() => setInterval(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <input type="hidden" name="interval" value={interval} />
      </fieldset>

      <div className="plan-line">
        <div>
          <strong>
            {PLANS.allin.name} · {formatPrice(plan)}
            {per}
          </strong>
          <p className="muted small-text">{PLANS.allin.description}</p>
        </div>
      </div>

      <label className="plan-team">
        Team members ({formatPrice(seat)}
        {per} each)
        <select name="team_members" value={team} onChange={(e) => setTeam(Number(e.target.value))}>
          {Array.from({ length: 11 }, (_, n) => (
            <option key={n} value={n}>
              {n === 0 ? "None (just me)" : `${n} team ${n === 1 ? "member" : "members"}`}
            </option>
          ))}
        </select>
      </label>

      <p className="plan-total">
        Total: <strong>
          {formatPrice(plan + team * seat)}
          {per}
        </strong>
        {team > 0 && (
          <span className="muted small-text">
            {" "}
            ({formatPrice(plan)} + {team} × {formatPrice(seat)})
          </span>
        )}
        {inTrial && (
          <span className="muted small-text">
            {" "}
            · You won&apos;t be charged until your free trial ends.
          </span>
        )}
      </p>
      <SubmitButton pendingText="Opening Stripe...">Continue to payment</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
