// "Manage my appointment" (/v/<code>): opened from every confirmation and
// reminder email, no sign-in. Shows the visit and lets the client
// reschedule, cancel, say they're running late, add it to their calendar,
// get directions or message the pro. The link only works for that one
// booking (lib/manageLink.js).
import Link from "next/link";
import { notFound } from "next/navigation";
import { clockTime, formatDate, timeZoneLabel } from "@/lib/availability";
import { formatPrice } from "@/lib/money";
import { loadVisitForManage } from "@/lib/manageLink";
import { createAdminClient } from "@/lib/supabase/admin";
import RunningLate from "./RunningLate";

export const dynamic = "force-dynamic";

export default async function ManagePage({ params }) {
  const { token } = await params;
  const v = await loadVisitForManage(token);
  if (!v) notFound();
  const s = v.stylist;
  const W = v.words;
  const book = `/book/${s.slug}`;
  const balance = v.deposit_status === "paid" ? Math.max(0, (v.price_cents || 0) - (v.deposit_cents || 0)) : null;
  const policy = String(v.cancellation_policy || "").trim();
  // The pro's form and waiver for this visit (step 55 SQL).
  const { data: waiver } = await createAdminClient().rpc("waiver_for_visit", { p_token: token });

  return (
    <div className="mv">
      <p className="bk-kicker">{s.business_name}</p>
      <h1 className="cl-title">{v.service_name}</h1>
      <p className="mv-when">
        {formatDate(v.booking_date)}
        <br />
        {clockTime(v.start_time)} – {clockTime(v.end_time)}{" "}
        <span className="muted small-text">({timeZoneLabel(s.timezone)} time)</span>
      </p>

      {v.status === "cancelled" && (
        <p className="message info">
          This {W.appointment} was cancelled. <Link href={book}>Book another time</Link>
        </p>
      )}
      {v.confirmed && v.ended && (
        <p className="message info">
          This {W.appointment} has passed. <Link href={book}>Book again</Link>
        </p>
      )}

      <section className="card mv-details">
        <dl>
          {v.price_cents > 0 && (
            <div>
              <dt>Price</dt>
              <dd>{formatPrice(v.price_cents)}</dd>
            </div>
          )}
          {v.deposit_cents > 0 && (
            <div>
              <dt>Deposit</dt>
              <dd>
                {v.deposit_status === "paid"
                  ? `${formatPrice(v.deposit_cents)} paid${balance > 0 ? ` · ${formatPrice(balance)} left to pay at your ${W.appointment}` : ""}`
                  : v.deposit_status === "unpaid"
                    ? `${formatPrice(v.deposit_cents)} due`
                    : formatPrice(v.deposit_cents)}
              </dd>
            </div>
          )}
          {waiver?.has_form && (
            <div>
              <dt>Waiver</dt>
              <dd>{waiver.needed ? <a href={`/v/${token}/waiver`}>Not signed yet · Sign now</a> : "Signed ✓"}</dd>
            </div>
          )}
          {v.location && (
            <div>
              <dt>{v.online ? "Online" : "Where"}</dt>
              <dd>{v.online ? <a href={v.location}>Join your {W.appointment}</a> : v.location}</dd>
            </div>
          )}
        </dl>
        {v.deposit_status === "unpaid" && v.deposit_cents > 0 && v.upcoming && (
          <a href={`${book}/pay?t=${token}`} className="button">
            Pay your {formatPrice(v.deposit_cents)} deposit
          </a>
        )}
      </section>

      {v.upcoming && (
        <section className="card mv-actions">
          {v.today && <RunningLate token={token} />}
          <div className="mv-grid">
            {waiver?.needed && (
              <a href={`/v/${token}/waiver`} className="button">
                Sign waiver
              </a>
            )}
            <a href={`${book}/reschedule?t=${token}`} className="button">
              Reschedule
            </a>
            <a href={`${book}/cancel?t=${token}`} className="button secondary">
              Cancel
            </a>
            <a href={`/v/${token}/calendar`} className="button secondary">
              Add to Apple / Outlook
            </a>
            <a href={v.google} className="button secondary" target="_blank" rel="noreferrer">
              Add to Google
            </a>
            {v.directions && (
              <a href={v.directions} className="button secondary" target="_blank" rel="noreferrer">
                Get directions
              </a>
            )}
            {s.reply_email && (
              <a href={`mailto:${s.reply_email}?subject=${encodeURIComponent(`My ${v.service_name} on ${formatDate(v.booking_date)}`)}`} className="button secondary">
                Message {s.business_name}
              </a>
            )}
          </div>
          {policy && (
            <p className="muted small-text">
              <strong>Cancellation policy:</strong> {policy}
            </p>
          )}
        </section>
      )}

      <p className="muted small-text mv-foot">
        {s.pro_code && (
          <>
            {s.business_name}&apos;s ID is <strong>{s.pro_code}</strong>.{" "}
          </>
        )}
        <Link href={book}>Book another {W.appointment}</Link>
        {s.pro_code && (
          <>
            {" "}
            · <Link href={`/client?code=${s.pro_code}`}>All your {W.appointments}</Link>
          </>
        )}
      </p>
    </div>
  );
}
