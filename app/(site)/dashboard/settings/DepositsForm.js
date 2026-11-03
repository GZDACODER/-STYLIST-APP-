"use client";

import { useActionState, useState } from "react";
import { saveDeposits } from "./actions";
import { formatPrice } from "@/lib/money";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

// What the client would pay now, matching the database's rule
// (deposits under Stripe's 50¢ minimum are skipped).
function depositPreview(type, amountText, priceCents) {
  const amount = Number(amountText);
  if (type === "none" || !amountText || !Number.isFinite(amount) || amount <= 0) return null;
  const cents =
    type === "fixed"
      ? Math.min(Math.round(amount * 100), priceCents)
      : Math.round((priceCents * Math.min(amount, 100)) / 100);
  if (cents < 50) return "Under 50¢, so no deposit is taken.";
  return `Client pays ${formatPrice(cents)} now, ${formatPrice(priceCents - cents)} at the appointment.`;
}

function ServiceDepositRow({ service }) {
  const [type, setType] = useState(service.deposit_type);
  const [amount, setAmount] = useState(
    service.deposit_type === "fixed"
      ? String(service.deposit_amount / 100)
      : service.deposit_type === "percent"
        ? String(service.deposit_amount)
        : ""
  );
  const preview = depositPreview(type, amount, service.price_cents);

  return (
    <li className="deposit-row">
      <div>
        <div className="service-name">{service.name}</div>
        <div className="muted">{formatPrice(service.price_cents)}</div>
      </div>
      <div className="row">
        <label>
          Deposit
          <select
            name={`deposit_type_${service.id}`}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="none">No deposit</option>
            <option value="fixed">Dollar amount ($)</option>
            <option value="percent">Percent of price (%)</option>
          </select>
        </label>
        {type !== "none" && (
          <label>
            {type === "fixed" ? "Amount ($)" : "Percent (%)"}
            <input
              name={`deposit_amount_${service.id}`}
              type="number"
              inputMode="decimal"
              min={type === "fixed" ? "0.50" : "1"}
              max={type === "fixed" ? service.price_cents / 100 : "100"}
              step={type === "fixed" ? "0.01" : "1"}
              placeholder={type === "fixed" ? "20" : "25"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
        )}
      </div>
      {preview && <p className="muted small-text">{preview}</p>}
    </li>
  );
}

export default function DepositsForm({ enabled, policy, stripeReady, services }) {
  const [state, formAction] = useActionState(saveDeposits, null);

  return (
    <form action={formAction}>
      <label className="check-row">
        <input type="checkbox" name="deposits_enabled" defaultChecked={enabled} />
        Take deposits when clients book online
      </label>
      {!stripeReady && (
        <p className="muted small-text">
          Connect Stripe above before turning deposits on. You can set the amounts now.
        </p>
      )}
      <p className="muted small-text">
        Clients pay the deposit on Stripe before their booking is confirmed. If they don&apos;t
        pay, the time isn&apos;t booked.
      </p>

      <h3 className="list-title">Deposit for each service</h3>
      {services.length === 0 ? (
        <p className="muted">Add a service on the Services tab first.</p>
      ) : (
        <ul className="service-list">
          {services.map((s) => (
            <ServiceDepositRow key={s.id} service={s} />
          ))}
        </ul>
      )}

      <label>
        Cancellation policy
        <textarea
          name="cancellation_policy"
          rows={5}
          maxLength={2000}
          defaultValue={policy}
          placeholder="e.g. Please give 24 hours' notice to cancel or move your appointment. Deposits are not refunded for late cancellations or no-shows."
        />
      </label>
      <p className="muted small-text">
        Clients see this on your booking page and must agree to it before paying a deposit.
      </p>

      <SubmitButton pendingText="Saving...">Save deposits</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
