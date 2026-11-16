"use client";

// For a paid plan: how many team members it pays for. Changing it updates the
// Stripe subscription straight away, prorated for the rest of the period.
import { useActionState, useState } from "react";
import { changeTeamMembers } from "./billingActions";
import { PLANS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function TeamMembersForm({ count, yearly }) {
  const [state, formAction] = useActionState(changeTeamMembers, null);
  const [value, setValue] = useState(count);
  const seat = yearly ? PLANS.team.yearlyCents : PLANS.team.monthlyCents;
  const per = yearly ? "/yr" : "/mo";

  return (
    <form action={formAction} className="team-form">
      <label className="plan-team">
        Team members ({formatPrice(seat)}
        {per} each)
        <select name="team_members" value={value} onChange={(e) => setValue(Number(e.target.value))}>
          {Array.from({ length: Math.max(11, count + 1) }, (_, n) => (
            <option key={n} value={n}>
              {n === 0 ? "None (just me)" : `${n} team ${n === 1 ? "member" : "members"}`}
            </option>
          ))}
        </select>
      </label>
      {value !== count && (
        <p className="muted small-text">
          {value > count
            ? `Adds ${formatPrice((value - count) * seat)}${per}, charged now for the rest of this period.`
            : `Takes ${formatPrice((count - value) * seat)}${per} off, credited for the rest of this period.`}
        </p>
      )}
      <SubmitButton pendingText="Saving..." disabled={value === count}>
        Update team members
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
