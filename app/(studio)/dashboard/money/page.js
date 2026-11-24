// Money: what you've earned by day, week, month or year (four tiles and a
// chart), then tabs: payments you recorded outside the app (cash, Zelle,
// Cash App...), balances owed, Stripe payouts and gift cards. Record a
// payment opens in the slide-over; exports are in the Export menu (step 62 SQL).
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import { formatPrice } from "@/lib/money";
import { formatDate } from "@/lib/availability";
import { getStripe } from "@/lib/stripe";
import PageHeader from "@/components/dash/PageHeader";
import SubmitButton from "@/components/SubmitButton";
import { loadMoney } from "@/lib/moneyData";
import { sample } from "@/lib/examples";
import { getMyTemplate } from "@/lib/templates/server";
import { KIND_LABEL, METHOD_LABEL, VIEWS } from "@/lib/moneyTab";
import MoneyChart from "./MoneyChart";
import RecordPayment from "./RecordPayment";
import BalanceActions from "./BalanceActions";
import { deletePayment } from "./actions";
import AddPanel from "../shell/AddPanel";
import SplitMenu from "../shell/SplitMenu";
import GiftCardsBody from "./GiftCardsBody";

const TABS = [
  ["payments", "Payments"],
  ["owed", "Balances owed"],
  ["payouts", "Stripe payouts"],
  ["gifts", "Gift cards"],
];

export const metadata = { title: `Money · ${BRAND_NAME}` };

const short = (t) => new Date(`${t}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

async function stripeInfo(stylist) {
  if (!stylist?.stripe_account_id || !stylist.stripe_charges_enabled) return null;
  try {
    const stripe = getStripe();
    const opts = { stripeAccount: stylist.stripe_account_id };
    const [balance, payouts] = await Promise.all([stripe.balance.retrieve({}, opts), stripe.payouts.list({ limit: 6 }, opts)]);
    const sum = (list) => (list || []).filter((x) => x.currency === "usd").reduce((a, x) => a + x.amount, 0);
    return {
      available: sum(balance.available),
      pending: sum(balance.pending),
      payouts: payouts.data.map((p) => ({ id: p.id, amount: p.amount, arrival: new Date(p.arrival_date * 1000).toISOString().slice(0, 10), status: p.status })),
    };
  } catch {
    return { error: true };
  }
}

export default async function MoneyPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const m = await loadMoney(supabase, user.id, { view: sp.view, date: sp.date });
  const [{ data: clients }, stripe] = await Promise.all([
    supabase.from("clients").select("id, name").order("name").limit(2000),
    stripeInfo(m.stylist),
  ]);
  const t = m.totals;
  const q = (view, date) => `/dashboard/money?view=${view}&date=${date}`;
  const methods = Object.entries(t.byMethod).sort((a, b) => b[1] - a[1]);
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab : "payments";
  const tq = (k) => `/dashboard/money?view=${m.view}&date=${m.period.from}&tab=${k}`;
  const owedCents = m.balances.reduce((a, b) => a + b.owedNow, 0);
  const tiles = [
    { label: "Earned", value: formatPrice(t.totalCents), note: m.period.label },
    { label: "Deposits online", value: formatPrice(t.depositsCents), note: "Part of what you earned" },
    {
      label: "Owed to you",
      value: formatPrice(owedCents),
      note: `${m.balances.length} ${m.balances.length === 1 ? "visit" : "visits"}, any date`,
      href: tq("owed"),
    },
    {
      label: "Available to pay out",
      value: stripe && !stripe.error ? formatPrice(stripe.available) : "—",
      note: !stripe ? "Connect Stripe to see" : stripe.error ? "Stripe didn't answer" : `${formatPrice(stripe.pending)} on its way`,
      href: tq("payouts"),
    },
  ];
  const exportBase = `/dashboard/money/export?view=${m.view}&date=${m.period.from}`;

  return (
    <>
      <PageHeader
        guide="money"
        title="Money"
        subtitle="What you've earned, what's owed, and payments you take outside the app."
        actions={
          <>
            <SplitMenu label="Export" className="button ghost small">
              <a href={`${exportBase}&format=csv`}>Spreadsheet (CSV) · {m.period.label}</a>
              <a href={`${exportBase}&format=pdf`}>Summary (PDF) · {m.period.label}</a>
            </SplitMenu>
            <AddPanel id="record" label="Record a payment" title="Record a payment">
              <p className="muted small-text">
                Cash, Zelle, Cash App or anything else you take outside the app: tips, product sales or other income.
              </p>
              <RecordPayment clients={clients || []} today={m.today} notePlaceholder={sample(await getMyTemplate()).paymentNote} />
            </AddPanel>
          </>
        }
      />
      {m.error && <p className="message error">Money isn&apos;t set up yet (step 62 SQL).</p>}

      <div className="mn-periodbar">
        <nav className="cr-tabs" aria-label="Period">
          {VIEWS.map(([k, l]) => (
            <a key={k} href={`${q(k, m.today)}&tab=${tab}`} className={m.view === k ? "cr-tab active" : "cr-tab"}>
              {l}
            </a>
          ))}
        </nav>
        <div className="mn-period">
          <a href={`${q(m.view, m.period.prev)}&tab=${tab}`} aria-label="Earlier">‹</a>
          <strong>{m.period.label}</strong>
          <a href={`${q(m.view, m.period.next)}&tab=${tab}`} aria-label="Later">›</a>
        </div>
      </div>

      <section className="stat-row" aria-label="Money at a glance">
        {tiles.map((c) =>
          c.href ? (
            <Link key={c.label} href={c.href} className="stat-tile">
              <span className="stat-label">{c.label}</span>
              <strong className="stat-value">{c.value}</strong>
              <span className="stat-note">{c.note}</span>
            </Link>
          ) : (
            <div key={c.label} className="stat-tile">
              <span className="stat-label">{c.label}</span>
              <strong className="stat-value">{c.value}</strong>
              <span className="stat-note">{c.note}</span>
            </div>
          )
        )}
      </section>

      <section className="card mn-summary">
        <MoneyChart series={t.series} today={m.today} />
        <div className={methods.length > 0 ? "stack-cols mn-breakdown" : "mn-breakdown"}>
          <dl className="mn-lines stack-col">
            <div>
              <dt>
                Services · {t.visits} {t.visits === 1 ? "visit" : "visits"}
              </dt>
              <dd>{formatPrice(t.servicesCents)}</dd>
            </div>
            <div>
              <dt>Tips</dt>
              <dd>{formatPrice(t.tipsCents)}</dd>
            </div>
            <div>
              <dt>Product sales</dt>
              <dd>{formatPrice(t.productCents)}</dd>
            </div>
            <div>
              <dt>Other income</dt>
              <dd>{formatPrice(t.otherCents)}</dd>
            </div>
          </dl>
          {methods.length > 0 && (
            <div className="stack-col">
              <p className="muted small-text mn-sub">How you were paid</p>
              <dl className="mn-lines">
                {methods.map(([k, c]) => (
                  <div key={k}>
                    <dt>{k === "stripe" ? "Online deposits (Stripe)" : METHOD_LABEL[k]}</dt>
                    <dd>{formatPrice(c)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
        {t.balancesCents > 0 && (
          <p className="muted small-text">{formatPrice(t.balancesCents)} in balances was paid off.</p>
        )}
        <p className="muted small-text">
          Rebooking, busy times and clients to invite back are in <Link href="/dashboard/reports">Insights</Link>.
        </p>
      </section>

      <nav className="cr-tabs page-tabs" aria-label="Money">
        {TABS.map(([k, l]) => (
          <Link key={k} href={tq(k)} className={tab === k ? "cr-tab active" : "cr-tab"} scroll={false}>
            {l}
            {k === "owed" && m.balances.length > 0 ? ` (${m.balances.length})` : ""}
          </Link>
        ))}
      </nav>
      {tab === "owed" && (
      <section className="card">
        <h2>Balances owed</h2>
        {m.balances.length === 0 ? (
          <p className="muted small-text">Nobody owes you anything. Visits you mark &quot;owes a balance&quot; when you wrap up show here.</p>
        ) : (
          <>
            <p className="muted small-text">
              {formatPrice(m.balances.reduce((a, b) => a + b.owedNow, 0))} owed across {m.balances.length}{" "}
              {m.balances.length === 1 ? "visit" : "visits"}.
            </p>
            <ul className="rq-list">
              {m.balances.map((b) => (
                <li key={b.id} className="mn-row">
                  <p className="rq-head">
                    <span>{b.client_name}</span>
                    <strong>{formatPrice(b.owedNow)}</strong>
                  </p>
                  <p className="muted small-text">
                    {b.service_name} · {formatDate(b.booking_date)}
                    {b.balance_reminded_at ? ` · reminded ${short(b.balance_reminded_at.slice(0, 10))}` : ""}
                  </p>
                  <BalanceActions id={b.id} owedCents={b.owedNow} canEmail={Boolean(b.client_email)} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      )}

      {tab === "payments" && (
      <section className="card">
        <h2>Payments you recorded</h2>
        {m.payments.length === 0 ? (
          <p className="muted small-text">
            None in {m.period.label}. Use Record a payment for cash, Zelle, tips and product sales.
          </p>
        ) : (
          <ul className="rq-list">
            {m.payments.map((p) => (
              <li key={p.id} className="mn-row">
                <p className="rq-head">
                  <span>
                    {KIND_LABEL[p.kind]}
                    {p.client_name ? ` · ${p.client_name}` : ""}
                  </span>
                  <strong>{formatPrice(p.amount_cents)}</strong>
                </p>
                <p className="muted small-text">
                  {short(p.paid_on)} · {METHOD_LABEL[p.method]}
                  {p.note ? ` · ${p.note}` : ""}
                </p>
                <form action={deletePayment}>
                  <input type="hidden" name="id" value={p.id} />
                  <SubmitButton className="link-button small-text" pendingText="Removing...">
                    Remove
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      )}

      {tab === "payouts" && (
      <section className="card">
        <h2>Stripe payouts</h2>
        {!stripe ? (
          <p className="muted small-text">
            Deposits paid online go to your own Stripe account, then to your bank. <Link href="/dashboard/settings/deposits">Connect Stripe</Link> to see payouts here.
          </p>
        ) : stripe.error ? (
          <p className="muted small-text">Couldn&apos;t reach Stripe just now. Try again in a minute.</p>
        ) : (
          <>
            <dl className="mn-lines">
              <div>
                <dt>On its way to your bank</dt>
                <dd>{formatPrice(stripe.pending)}</dd>
              </div>
              <div>
                <dt>Available to pay out</dt>
                <dd>{formatPrice(stripe.available)}</dd>
              </div>
            </dl>
            {stripe.payouts.length ? (
              <ul className="rq-list">
                {stripe.payouts.map((p) => (
                  <li key={p.id} className="mn-row">
                    <p className="rq-head">
                      <span>
                        {p.status === "paid" ? "Paid" : p.status === "in_transit" ? "On its way" : p.status[0].toUpperCase() + p.status.slice(1)} · {short(p.arrival)}
                      </span>
                      <strong>{formatPrice(p.amount)}</strong>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small-text">No payouts yet.</p>
            )}
          </>
        )}
      </section>
      )}

      {tab === "gifts" && <GiftCardsBody />}
    </>
  );
}
