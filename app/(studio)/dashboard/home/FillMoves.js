"use client";

// Home > Fill your book: up to three real one-tap moves (lib/homeFill.js
// pickMoves): remind a client about a balance, invite an overdue client
// back, add openings for a thin week, or share the booking link. Each
// button uses an existing action and shows its result right on the card.
import { useActionState } from "react";
import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import { useTemplate } from "@/components/TemplateContext";
import { remindBalance } from "../money/actions";
import { inviteBack } from "../reports/actions";
import ShareCta from "../shell/ShareCta";

const money = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: (cents || 0) % 100 ? 2 : 0 }).format((cents || 0) / 100);
const hours = (m) => {
  const h = Math.round((m / 60) * 2) / 2;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
};

// A move whose button runs a server action, with its result in place.
function ActionMove({ kind, title, text, action, fields, button, extra }) {
  const [state, run] = useActionState(action, null);
  const done = Boolean(state?.success);
  return (
    <li className={`hf-move hf-move-${kind}${done ? " is-done" : ""}`}>
      <p className="hf-move-title">{title}</p>
      {text && <p className="hf-move-text">{text}</p>}
      {done ? (
        <p className="hf-move-result" role="status">
          ✓ {state.success}
        </p>
      ) : (
        <form action={run} className="hf-move-actions">
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v ?? ""} />
          ))}
          <SubmitButton className="button small" pendingText="Sending...">
            {button}
          </SubmitButton>
          {extra}
        </form>
      )}
      {state?.error && <p className="small-text message error">{state.error}</p>}
    </li>
  );
}

function LinkMove({ kind, title, text, href, button }) {
  return (
    <li className={`hf-move hf-move-${kind}`}>
      <p className="hf-move-title">{title}</p>
      {text && <p className="hf-move-text">{text}</p>}
      <div className="hf-move-actions">
        <Link href={href} className="button small">
          {button}
        </Link>
      </div>
    </li>
  );
}

export default function FillMoves({ moves, bookingUrl, businessName }) {
  const { words } = useTemplate();
  return (
    <ul className="hf-moves">
      {moves.map((m) => {
        if (m.kind === "owed") {
          const title = `${money(m.owedCents)} owed by ${m.clientName}`;
          const text = m.serviceName ? `for ${m.serviceName}` : null;
          return m.canEmail ? (
            <ActionMove key="owed" kind="owed" title={title} text={text} action={remindBalance} fields={{ id: m.bookingId, owed: m.owedCents }} button="Send reminder" />
          ) : (
            <LinkMove key="owed" kind="owed" title={title} text={text} href="/dashboard/money?tab=owed" button="Open Money" />
          );
        }
        if (m.kind === "overdue") {
          return (
            <ActionMove
              key="overdue"
              kind="overdue"
              title={m.usualWeeks ? `${m.name} usually comes every ${m.usualWeeks} ${m.usualWeeks === 1 ? "week" : "weeks"}. It's been ${m.sinceWeeks}.` : `It's been ${m.sinceWeeks} weeks since ${m.name}'s visit.`}
              action={inviteBack}
              fields={{ id: m.clientId, booking_id: m.bookingId, service_id: m.serviceId }}
              button="Invite back"
              extra={
                m.more > 0 ? (
                  <Link href="/dashboard/reports?tab=clients" className="small-text">
                    +{m.more} more in Insights
                  </Link>
                ) : null
              }
            />
          );
        }
        if (m.kind === "thin") {
          return (
            <LinkMove
              key="thin"
              kind="thin"
              title={`Next week has ${m.nextWeekOpenTimes === 0 ? "no open times yet" : `only ${m.nextWeekOpenTimes} open ${m.nextWeekOpenTimes === 1 ? "time" : "times"}`}.`}
              href="/dashboard/openings#add-opening"
              button="Add opening"
            />
          );
        }
        if (m.kind === "setup-services") {
          return <LinkMove key="ss" kind="setup" title={`Add your ${words.services || "services"} so ${words.clients || "clients"} can book.`} href="/dashboard/services" button={`Add ${words.services || "services"}`} />;
        }
        if (m.kind === "setup-openings") {
          return <LinkMove key="so" kind="setup" title={`Open some times so ${words.clients || "clients"} can book.`} href="/dashboard/openings#add-opening" button="Add opening" />;
        }
        // share
        return (
          <li key="share" className="hf-move hf-move-share">
            <p className="hf-move-title">
              {m.thisWeekOpenMinLeft > 0 ? `${hours(m.thisWeekOpenMinLeft)} hours still open this week.` : "Keep next week filling up."}
            </p>
            <p className="hf-move-text">Share your link where your {words.clients || "clients"} will see it.</p>
            <div className="hf-move-actions">
              <ShareCta url={bookingUrl} businessName={businessName} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
