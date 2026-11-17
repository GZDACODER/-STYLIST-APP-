"use client";

// Homepage pricing with a Monthly / Yearly switch. Amounts come from
// lib/plans.js (yearly = 10 × monthly, i.e. 2 months free).
import { useState } from "react";
import Link from "next/link";

const money = (cents) => {
  const dollars = cents / 100;
  return `$${dollars % 1 ? dollars.toFixed(2) : dollars}`;
};

export default function PricingToggle({ allin, team, assistant, trialDays, included, assistantOn }) {
  const [yearly, setYearly] = useState(false);
  const per = yearly ? "/yr" : "/mo";
  const pick = (plan) => money(yearly ? plan.yearlyCents : plan.monthlyCents);

  return (
    <div className="hm-pricing">
      <div className="hm-toggle" role="group" aria-label="Billing">
        <button type="button" className={!yearly ? "active" : ""} aria-pressed={!yearly} onClick={() => setYearly(false)}>
          Monthly
        </button>
        <button type="button" className={yearly ? "active" : ""} aria-pressed={yearly} onClick={() => setYearly(true)}>
          Yearly <span className="hm-toggle-save">2 months free</span>
        </button>
      </div>

      <div className="hm-price-grid">
        <div className="hm-price-card is-main">
          <span className="hm-tier-badge">All-in</span>
          <p className="hm-price">
            {pick(allin)}
            <span>{per}</span>
          </p>
          <p className="hm-plan-alt">Every feature, for one pro.{yearly ? " Billed once a year." : ""}</p>
          <details className="hm-included">
            <summary>Everything included</summary>
            <ul className="hm-plan-list">
              {included.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
          <Link href="/signup" className="hm-button">
            Start {trialDays}-day free trial
          </Link>
        </div>

        <div className="hm-price-card">
          <span className="hm-tier-badge is-quiet">Team members</span>
          <p className="hm-price is-small">
            {pick(team)}
            <span>{per} each</span>
          </p>
          <p className="hm-plan-alt">Half the price of the plan. Add or remove any time.</p>
        </div>

        {assistantOn && (
          <div className="hm-price-card">
            <span className="hm-tier-badge is-quiet">Optional · Assistant</span>
            <p className="hm-price is-small">
              {pick(assistant)}
              <span>{per}</span>
            </p>
            <p className="hm-plan-alt">Ask about your schedule and make changes in your own words. Included in the free trial.</p>
          </div>
        )}
      </div>
    </div>
  );
}
