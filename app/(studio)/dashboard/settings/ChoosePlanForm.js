"use client";

import { useActionState, useState } from "react";
import { startCheckout } from "./billingActions";
import { PLANS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

// Pick Clientele or All-in, any add-ons, monthly or yearly, then pay on Stripe.
export default function ChoosePlanForm({ inTrial }) {
  const [state, formAction] = useActionState(startCheckout, null);
  const [interval, setInterval] = useState("month");
  const [plan, setPlan] = useState("base");
  const [addOns, setAddOns] = useState({ regulars: false, waitlist: false });

  const price = (key) =>
    interval === "year" ? PLANS[key].yearlyCents : PLANS[key].monthlyCents;
  const per = interval === "year" ? "/yr" : "/mo";
  const total =
    plan === "bundle"
      ? price("bundle")
      : price("base") +
        (addOns.regulars ? price("regulars") : 0) +
        (addOns.waitlist ? price("waitlist") : 0);

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

      <fieldset className="field">
        <legend>Plan</legend>
        {["base", "bundle"].map((key) => (
          <label key={key} className="check-row">
            <input
              type="radio"
              name="plan"
              value={key}
              checked={plan === key}
              onChange={() => setPlan(key)}
            />
            <span>
              <strong>
                {PLANS[key].name} · {formatPrice(price(key))}
                {per}
              </strong>
              <br />
              <span className="muted small-text">{PLANS[key].description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {plan === "base" && (
        <fieldset className="field">
          <legend>Add-ons</legend>
          {["regulars", "waitlist"].map((key) => (
            <label key={key} className="check-row">
              <input
                type="checkbox"
                name={key}
                checked={addOns[key]}
                onChange={(e) => setAddOns({ ...addOns, [key]: e.target.checked })}
              />
              <span>
                <strong>
                  {PLANS[key].name} · +{formatPrice(price(key))}
                  {per}
                </strong>
                <br />
                <span className="muted small-text">{PLANS[key].description}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <p className="plan-total">
        Total: <strong>{formatPrice(total)}{per}</strong>
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
