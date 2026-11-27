// Shop: one owner, several chairs (0081 SQL). The owner sees every chair
// on one page (today's appointments, the week, money this month, payouts)
// and adds or removes chairs; the bill follows. A chair sees their shop
// and can leave. Anyone else can start a shop.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/user";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import PageHeader from "@/components/dash/PageHeader";
import ConfirmAction from "@/components/ConfirmAction";
import CopyLinkButton from "@/components/dash/CopyLinkButton";
import { formatPrice } from "@/lib/money";
import { clockTime } from "@/lib/availability";
import { PLANS } from "@/lib/plans";
import { shopPriceCents } from "@/lib/shops";
import { shopRoles } from "@/lib/shopsServer";
import { publicSiteUrl } from "@/lib/siteUrl";
import { getMyTemplate } from "@/lib/templates/server";
import { sample } from "@/lib/examples";
import { AddChairForm, RenameShopForm, StartShopForm } from "./ShopForms";
import { cancelInvite, leaveShop, removeChair } from "./actions";
import "./shop.css";

export const metadata = { title: `Shop · ${BRAND_NAME}` };

const initial = (name) => (String(name || "").trim()[0] || "C").toUpperCase();

function Avatar({ photo, name }) {
  return /^https:\/\//.test(photo || "") ? (
    <img className="sh-avatar" src={photo} alt="" width="40" height="40" />
  ) : (
    <span className="sh-avatar sh-mono" aria-hidden="true">
      {initial(name)}
    </span>
  );
}

export default async function ShopPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const [roles, { data: me }] = await Promise.all([
    shopRoles(user.id),
    supabase.from("stylists").select("business_name").eq("id", user.id).maybeSingle(),
  ]);
  const site = publicSiteUrl("https://www.clientelesuite.com");

  // ---------- A chair in someone's shop ----------
  if (roles.chairIn) {
    const { shop, chair } = roles.chairIn;
    return (
      <>
        <PageHeader guide="shop_chair" title="Shop" subtitle={`You're a chair at ${shop.name}.`} />
        <section className="card stack">
          <h2>{shop.name}</h2>
          <p>
            {shop.owner?.business_name || "The shop owner"} pays for your Clientele plan. Your booking page, calendar, clients and
            Stripe payouts are your own, and stay yours if you ever leave.
          </p>
          <p className="muted small-text">
            The owner sees your appointments for today, how many you have this week and your total for the month. They don&apos;t
            see your client list or notes.
          </p>
          <ConfirmAction
            label="Leave this shop"
            question={`Leave ${shop.name}?`}
            note="Your account, clients and bookings stay yours. The shop stops paying for your plan, so choose a plan in Settings to keep everything on."
            keepLabel="Stay"
            confirmLabel="Yes, leave"
            pendingText="Leaving..."
            action={leaveShop}
            fields={{ id: chair.id }}
          />
        </section>
      </>
    );
  }

  // ---------- Not in a shop yet ----------
  if (!roles.owns) {
    return (
      <>
        <PageHeader guide="shop" title="Shop" subtitle="Run a shop? Put every chair on one account and one bill." />
        <section className="card stack">
          <h2>Start a shop</h2>
          <p>
            Add each barber or stylist who works in your shop as a chair. Each chair gets their own booking page, calendar, clients
            and Stripe payouts. You see every chair on this page.
          </p>
          <dl className="plan-sum">
            <div>
              <dt>Your chair</dt>
              <dd>{formatPrice(PLANS.allin.monthlyCents)}/mo</dd>
            </div>
            <div>
              <dt>Each extra chair</dt>
              <dd>{formatPrice(PLANS.chair.monthlyCents)}/mo</dd>
            </div>
            <div className="plan-sum-total">
              <dt>A 4-chair shop</dt>
              <dd>{formatPrice(shopPriceCents(3))}/mo</dd>
            </div>
          </dl>
          <p className="muted small-text">One subscription. Adding or removing a chair changes it automatically, prorated.</p>
          <StartShopForm defaultName={me?.business_name || ""} />
        </section>
      </>
    );
  }

  // ---------- The owner ----------
  const [{ data: overview, error }, template] = await Promise.all([supabase.rpc("shop_overview"), getMyTemplate().catch(() => null)]);
  const chairs = overview?.chairs || [];
  const invites = overview?.invites || [];
  const extra = chairs.filter((c) => !c.is_owner).length;
  const todayCount = chairs.reduce((n, c) => n + (c.today?.length || 0), 0);
  const weekCount = chairs.reduce((n, c) => n + (c.week || 0), 0);
  const monthCents = chairs.reduce((n, c) => n + (c.month_cents || 0), 0);
  // A name from their trade's samples (lib/templates).
  const example = String(sample(template).owner || "Maya Jones").replace(/^e\.g\.\s*/, "");

  return (
    <>
      <PageHeader guide="shop" title={roles.owns.name} subtitle="Every chair in your shop, on one page." />
      {error && <p className="message error">Couldn&apos;t load your shop. Please refresh.</p>}

      <section className="stat-row" aria-label="Your shop at a glance">
        {[
          ["Chairs", String(chairs.length), extra === 0 ? "Just yours so far" : `You + ${extra}`],
          ["Today", String(todayCount), todayCount === 1 ? "appointment" : "appointments"],
          ["Next 7 days", String(weekCount), "booked"],
          ["This month", formatPrice(monthCents), "deposits + recorded"],
        ].map(([label, value, note]) => (
          <div key={label} className="stat-tile">
            <span className="stat-label">{label}</span>
            <strong className="stat-value">{value}</strong>
            <span className="stat-note">{note}</span>
          </div>
        ))}
      </section>

      <section className="sh-chairs" aria-label="Chairs">
        {chairs.map((c) => (
          <article key={c.stylist_id} className="card sh-chair">
            <header className="sh-chair-head">
              <Avatar photo={c.photo} name={c.business_name} />
              <div>
                <h2>
                  {c.business_name}
                  {c.is_owner && <span className="badge">You</span>}
                </h2>
                <p className="muted small-text">
                  {c.slug ? (
                    <a href={`${site}/book/${c.slug}`} target="_blank" rel="noreferrer">
                      Booking page
                    </a>
                  ) : (
                    "No booking page yet"
                  )}
                  {" · "}
                  <span className={c.payouts ? "sh-ok" : "sh-warn"}>{c.payouts ? "Payouts on" : "Payouts not set up"}</span>
                </p>
              </div>
            </header>
            <div className="sh-nums">
              <span>
                <strong>{c.week}</strong> next 7 days
              </span>
              <span>
                <strong>{formatPrice(c.month_cents || 0)}</strong> this month
              </span>
            </div>
            {c.today?.length ? (
              <ul className="sh-today">
                {c.today.map((b, i) => (
                  <li key={i}>
                    <span className="sh-time">{clockTime(b.time)}</span>
                    <span>
                      {b.service}
                      {b.client ? ` · ${b.client}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small-text">Nothing booked today.</p>
            )}
            {!c.is_owner && (
              <ConfirmAction
                label="Remove from shop"
                question={`Remove ${c.business_name} from your shop?`}
                note="Their account, clients and bookings stay theirs. Their chair comes off your plan today (prorated), and they'll need their own plan."
                keepLabel="Keep them"
                confirmLabel="Yes, remove"
                pendingText="Removing..."
                action={removeChair}
                fields={{ id: c.chair_id }}
              />
            )}
          </article>
        ))}
      </section>

      <section className="card stack" id="add-chair">
        <h2>Add a chair</h2>
        <p className="muted small-text">
          We email them an invite. They sign up (or log in) with that email and tap Join. They set up their own services, hours and
          Stripe payouts.
        </p>
        <AddChairForm example={example} />
        {invites.length > 0 && (
          <>
            <h3>Waiting to join</h3>
            <ul className="rq-list">
              {invites.map((v) => (
                <li key={v.id} className="mn-row sh-invite">
                  <span>
                    {v.name ? `${v.name} · ` : ""}
                    {v.email}
                  </span>
                  <span className="row">
                    <CopyLinkButton link={`${site}/join/shop/${v.token}`} label="Copy link" />
                    <form action={cancelInvite}>
                      <input type="hidden" name="id" value={v.id} />
                      <button type="submit" className="link-button small-text">
                        Cancel
                      </button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card stack">
        <h2>Your bill</h2>
        <dl className="plan-sum">
          <div>
            <dt>Your chair (All-in)</dt>
            <dd>{formatPrice(PLANS.allin.monthlyCents)}/mo</dd>
          </div>
          <div>
            <dt>Extra chairs × {extra}</dt>
            <dd>{formatPrice(extra * PLANS.chair.monthlyCents)}/mo</dd>
          </div>
          <div className="plan-sum-total">
            <dt>Total</dt>
            <dd>{formatPrice(shopPriceCents(extra))}/mo</dd>
          </div>
        </dl>
        <p className="muted small-text">
          One subscription: it changes by itself when a chair joins or leaves (prorated). Chairs are never billed while
          they&apos;re in your shop. During your free trial, chairs are free too. <Link href="/dashboard/settings/plan">Plan &amp; billing</Link>
        </p>
        <RenameShopForm name={roles.owns.name} />
      </section>
    </>
  );
}
