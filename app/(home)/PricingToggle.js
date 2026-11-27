"use client";

// Homepage pricing with a Monthly / Yearly switch. Amounts come from
// lib/plans.js (yearly = 10 × monthly, i.e. 2 months free).
import { useState } from "react";
import Link from "next/link";

const money = (cents) => {
  const dollars = cents / 100;
  return `$${dollars % 1 ? dollars.toFixed(2) : dollars}`;
};

export default function PricingToggle({ allin, chair, assistant, trialDays, included, assistantOn }) {
  const [yearly, setYearly] = useState(false);
  const per = yearly ? "/yr" : "/mo";
  const pick = (plan) => money(yearly ? plan.yearlyCents : plan.monthlyCents);

  return (
    <div className="ln-pricing">
      <div className="ln-toggle" role="group" aria-label="Billing">
        <button type="button" className={!yearly ? "active" : ""} aria-pressed={!yearly} onClick={() => setYearly(false)}>
          Monthly
        </button>
        <button type="button" className={yearly ? "active" : ""} aria-pressed={yearly} onClick={() => setYearly(true)}>
          Yearly <span className="ln-toggle-save">2 months free</span>
        </button>
      </div>

      <div className="ln-price-grid">
        <div className="ln-card ln-price-card is-main">
          <span className="ln-eyebrow">All-in</span>
          <p className="ln-price">
            {pick(allin)}
            <span>{per}</span>
          </p>
          <p className="ln-muted">Every feature, for one pro.{yearly ? " Billed once a year." : ""}</p>
          <details className="ln-included">
            <summary>Everything included</summary>
            <ul className="ln-checks">
              {included.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
          <Link href="/signup" className="ln-btn ln-btn-gold">
            Start your {trialDays}-day free trial
          </Link>
        </div>

        <div className="ln-card ln-price-card">
          <span className="ln-eyebrow">Run a shop? · Each extra chair</span>
          <p className="ln-price is-small">
            {pick(chair)}
            <span>{per} each</span>
          </p>
          <p className="ln-muted">
            Every chair gets its own booking page, calendar and payouts. You see them all on one page, on one bill.
          </p>
        </div>

        {assistantOn && (
          <div className="ln-card ln-price-card">
            <span className="ln-eyebrow">Optional · Assistant</span>
            <p className="ln-price is-small">
              {pick(assistant)}
              <span>{per}</span>
            </p>
            <p className="ln-muted">Ask about your schedule and make changes in your own words. Included in the free trial.</p>
          </div>
        )}
      </div>
    </div>
  );
}
