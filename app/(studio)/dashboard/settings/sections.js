// The Settings sections' contents (server components). Each loads only what
// it needs. Used by /dashboard/settings (Business, on iPad) and
// /dashboard/settings/[section].
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, paymentsConfigured } from "@/lib/stripe";
import { getMyPlan } from "@/lib/plan";
import { todayInTimeZone } from "@/lib/availability";
import SettingsForm from "./SettingsForm";
import DepositsForm from "./DepositsForm";
import RegularsForm from "./RegularsForm";
import RescheduleForm from "./RescheduleForm";
import PortfolioForm from "./PortfolioForm";
import CoverPhotoForm from "./CoverPhotoForm";
import BusinessLinksForm from "./BusinessLinksForm";
import PlanCard from "./PlanCard";
import HolidaySettings from "./HolidaySettings";
import PausedNote from "@/components/PausedNote";
import RegularStar from "@/components/RegularStar";

const STRIPE_NOTICES = {
  not_configured: {
    kind: "error",
    text: "Stripe isn't set up for this app yet. Add the Stripe keys in Vercel first (see DEPOSITS_SETUP.md).",
  },
  error: { kind: "error", text: "Stripe had a problem. Please try again in a minute." },
};

// The logged-in stylist's row (only these columns), or null.
async function me(columns) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, row: null };
  const { data: row } = await supabase.from("stylists").select(columns).eq("id", user.id).maybeSingle();
  return { supabase, user, row: row || {} };
}

// A column that may not exist yet (its SQL not run): "" / null instead.
async function optional(supabase, userId, column) {
  const { data } = await supabase.from("stylists").select(column).eq("id", userId).maybeSingle();
  return data?.[column] ?? null;
}

export async function BusinessSection() {
  const { supabase, user, row } = await me("business_name, timezone");
  if (!user) return null;
  const firstName = await optional(supabase, user.id, "first_name");
  return (
    <section className="card">
      <SettingsForm part="business" businessName={row.business_name} firstName={firstName || ""} timezone={row.timezone} />
    </section>
  );
}

export async function BookingPageSection() {
  const { supabase, user, row } = await me("slug");
  if (!user) return null;
  const [tagline, profile, cutoff, portfolio] = await Promise.all([
    optional(supabase, user.id, "tagline"),
    supabase.from("stylists").select("cover_photo_url, instagram, location").eq("id", user.id).maybeSingle(),
    optional(supabase, user.id, "reschedule_cutoff_hours"),
    supabase.from("portfolio_photos").select("id, url, caption, position").order("position").order("created_at"),
  ]);
  const p = profile.data || {};
  return (
    <>
      <section className="card">
        <h2>Link &amp; tagline</h2>
        <SettingsForm part="booking" slug={row.slug} tagline={tagline || ""} />
      </section>
      <section className="card">
        <h2>Photos &amp; links</h2>
        <CoverPhotoForm userId={user.id} coverUrl={p.cover_photo_url || ""} />
        <PortfolioForm photos={portfolio.data || []} ready={!portfolio.error} />
        <BusinessLinksForm instagram={p.instagram || ""} location={p.location || ""} />
      </section>
      <section className="card">
        <h2>Rescheduling</h2>
        <p className="muted">
          Clients can move their own appointment to another open time, from your booking page or the
          Reschedule link in their emails.
        </p>
        <RescheduleForm cutoffHours={cutoff ?? 24} />
      </section>
    </>
  );
}

export async function HolidaysSection() {
  const { supabase, user, row } = await me("timezone");
  if (!user) return null;
  const { data, error } = await supabase.from("stylist_holiday_settings").select("holiday_key, closed");
  return (
    <section className="card">
      <p className="muted">
        Close on a federal holiday every year, and clients can&apos;t book it, the waitlist isn&apos;t offered it,
        and standing appointments skip it. Bookings already made stay. All open to start with. To close just one
        year, tap the holiday on your Calendar.
      </p>
      {error ? (
        <p className="message info">
          Run <code>supabase/migrations/0039_calendar_extras.sql</code> in Supabase to switch this on.
        </p>
      ) : (
        <HolidaySettings
          closed={(data || []).filter((r) => r.closed).map((r) => r.holiday_key)}
          today={todayInTimeZone(row.timezone || "America/Chicago")}
        />
      )}
    </section>
  );
}

export async function RegularsSection() {
  const { supabase, user, row } = await me("auto_regular_after, regulars_only");
  if (!user) return null;
  const plan = await getMyPlan(supabase, user.id);
  return (
    <section className="card">
      <p className="muted">
        <RegularStar label={null} size={12} /> Regulars see your &quot;Regulars only&quot; openings. Clients are
        matched by their phone number and confirm with an email code.
      </p>
      {!plan.has.regulars && (
        <PausedNote feature="regulars">Your plan is paused, so Regulars-only mode is off.</PausedNote>
      )}
      <RegularsForm
        autoRegularAfter={row.auto_regular_after}
        regularsOnly={row.regulars_only}
        regularsOnlyAllowed={plan.has.regulars}
      />
    </section>
  );
}

// Asks Stripe whether the stylist's account can receive deposits yet, and
// saves the answer. (Only Stripe can say so, which is why stylists can't edit it.)
async function refreshStripeStatus(userId, accountId, savedEnabled) {
  try {
    const account = await getStripe().v2.core.accounts.retrieve(accountId, {
      include: ["configuration.recipient", "requirements"],
    });
    const transfers = account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers;
    const enabled = transfers?.status === "active";
    // Finished = Stripe isn't waiting on anything more from the stylist.
    const detailsSubmitted = !(account.requirements?.entries || []).some(
      (entry) => entry.awaiting_action_from === "user"
    );
    if (enabled !== savedEnabled) {
      await createAdminClient().from("stylists").update({ stripe_charges_enabled: enabled }).eq("id", userId);
    }
    return { enabled, detailsSubmitted };
  } catch (error) {
    console.error("Couldn't check Stripe account", error);
    return { enabled: savedEnabled, detailsSubmitted: savedEnabled };
  }
}

export async function DepositsSection({ stripeParam, reason }) {
  const { supabase, user, row } = await me(
    "deposits_enabled, cancellation_policy, stripe_account_id, stripe_charges_enabled"
  );
  if (!user) return null;
  const { data: services } = await supabase
    .from("services")
    .select("id, name, price_cents, deposit_type, deposit_amount")
    .order("created_at", { ascending: true });
  const configured = paymentsConfigured();
  let stripe = { connected: false, enabled: false, detailsSubmitted: false };
  if (row.stripe_account_id) {
    stripe = { connected: true, enabled: row.stripe_charges_enabled, detailsSubmitted: false };
    if (configured) {
      stripe = { connected: true, ...(await refreshStripeStatus(user.id, row.stripe_account_id, row.stripe_charges_enabled)) };
    }
  }
  const notice = STRIPE_NOTICES[stripeParam];
  return (
    <>
      <section className="card">
        <h2>Get paid with Stripe</h2>
        {notice && (
          <p className={`message ${notice.kind}`}>
            {notice.text}
            {reason && (
              <>
                <br />
                <span className="small-text">Details: {String(reason)}</span>
              </>
            )}
          </p>
        )}
        {!configured && !notice && (
          <p className="message warning">
            Stripe isn&apos;t set up for this app yet. Add the keys in Vercel (see DEPOSITS_SETUP.md), then come back
            here.
          </p>
        )}
        <div className="stripe-status">
          {stripe.enabled ? (
            <span className="badge paid">Connected</span>
          ) : stripe.connected ? (
            <span className="badge unpaid">Not finished</span>
          ) : (
            <span className="badge">Not connected</span>
          )}
          {stripe.enabled ? (
            <a href="/dashboard/stripe/dashboard" className="button secondary small">
              Open Stripe
            </a>
          ) : (
            configured && (
              <a href="/dashboard/stripe/connect" className="button small">
                {stripe.connected ? "Finish Stripe setup" : "Connect Stripe"}
              </a>
            )
          )}
        </div>
        <p className="muted small-text">
          {stripe.enabled
            ? "Deposits go straight into your own Stripe account, and Stripe pays them out to your bank."
            : stripe.connected && stripe.detailsSubmitted
              ? "Stripe is checking your details. This usually takes a few minutes. Refresh this page to check."
              : "Connect your own Stripe account so clients' deposits are paid to you. Stripe asks for your details and the bank account to pay you into."}
        </p>
      </section>

      <section className="card">
        <h2>Deposits</h2>
        <DepositsForm
          enabled={row.deposits_enabled}
          policy={row.cancellation_policy}
          stripeReady={stripe.enabled}
          services={services || []}
        />
      </section>
    </>
  );
}

export async function PlanSection({ billing }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const plan = await getMyPlan(supabase, user.id);
  if (!plan.ready) return <p className="muted">Plans aren&apos;t set up yet.</p>;
  return (
    <PlanCard
      plan={plan}
      billingNotice={billing}
      canPay={paymentsConfigured()}
      assistantAvailable={Boolean(process.env.ANTHROPIC_API_KEY)}
    />
  );
}

export async function EmailSection() {
  const { supabase, user } = await me("id");
  if (!user) return null;
  const replyEmail = await optional(supabase, user.id, "reply_email");
  return (
    <section className="card">
      <SettingsForm part="email" replyEmail={replyEmail || ""} loginEmail={user.email || ""} />
    </section>
  );
}
