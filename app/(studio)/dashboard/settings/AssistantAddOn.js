"use client";

// Settings → Plan & billing: the Assistant add-on ($10/mo or $100/yr).
//   - With a subscription: a switch to add or remove it (prorated).
//   - Founding (free) accounts without one: their own small checkout.
//   - In the trial, or choosing a plan: it's a tickbox in the plan form.
import { useActionState, useState } from "react";
import { changeAssistant, startAssistantCheckout } from "./billingActions";
import { PLANS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

function Toggle({ on, yearly }) {
  const [state, formAction] = useActionState(changeAssistant, null);
  const price = yearly ? `${formatPrice(PLANS.assistant.yearlyCents)}/yr` : `${formatPrice(PLANS.assistant.monthlyCents)}/mo`;
  return (
    <form action={formAction} className="team-form">
      <input type="hidden" name="assistant" value={on ? "off" : "on"} />
      <p className="muted small-text">
        {on
          ? `On your plan for ${price}. Removing it credits the rest of this period.`
          : `Adds ${price}, charged now for the rest of this period.`}
      </p>
      <SubmitButton className={on ? "button secondary small" : "button small"} pendingText="Saving...">
        {on ? "Remove the Assistant" : "Add the Assistant"}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

function FoundingCheckout() {
  const [state, formAction] = useActionState(startAssistantCheckout, null);
  const [interval, setInterval] = useState("month");
  return (
    <form action={formAction} className="team-form">
      <div className="segmented" role="group" aria-label="Billing">
        {[
          ["month", `${formatPrice(PLANS.assistant.monthlyCents)}/mo`],
          ["year", `${formatPrice(PLANS.assistant.yearlyCents)}/yr`],
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
      <SubmitButton className="button small" pendingText="Opening Stripe...">
        Add the Assistant
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export default function AssistantAddOn({ plan, canPay }) {
  const yearly = plan.interval === "year";
  const on = plan.has.assistant;
  let body;
  if (plan.subscribed && canPay) {
    body = <Toggle on={plan.assistantPaid} yearly={yearly} />;
  } else if (plan.comped && canPay) {
    body = <FoundingCheckout />;
  } else if (plan.inTrial) {
    body = (
      <p className="muted small-text">
        Included in your free trial. To keep it after that, tick <strong>Add the Assistant</strong> when you
        choose your plan below.
      </p>
    );
  } else {
    body = (
      <p className="muted small-text">
        Tick <strong>Add the Assistant</strong> when you choose your plan below.
      </p>
    );
  }

  return (
    <div className="addon">
      <div className="plan-line">
        <div>
          <strong>
            {PLANS.assistant.name} · {formatPrice(PLANS.assistant.monthlyCents)}/mo
          </strong>
          <span className="muted small-text"> or {formatPrice(PLANS.assistant.yearlyCents)}/yr · optional add-on</span>
          <p className="muted small-text">{PLANS.assistant.description}</p>
        </div>
        <span className={on ? "badge paid" : "badge"}>
          {plan.assistantPaid ? "On" : on ? "Trial" : "Off"}
        </span>
      </div>
      {body}
    </div>
  );
}
