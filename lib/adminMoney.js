// The owner's money page (/dashboard/admin/money): Clientele's own Stripe
// numbers boiled down. In: lists straight from Stripe (balance, application
// fees, paid invoices, subscriptions, payouts). Amounts in cents. Pure.

const sum = (list, f) => (list || []).reduce((s, x) => s + (f(x) || 0), 0);
const usd = (arr) => sum((arr || []).filter((b) => !b.currency || b.currency === "usd"), (b) => b.amount);

function monthBounds(now) {
  const d = new Date(now);
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
  const lastStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1) / 1000;
  return { start, lastStart };
}

// What one subscription brings in per month (yearly ÷ 12).
function monthly(sub) {
  return sum(sub.items?.data, (it) => {
    const p = it.price || {};
    const each = (p.unit_amount || 0) * (it.quantity || 1);
    const r = p.recurring || {};
    const n = r.interval_count || 1;
    return r.interval === "year" ? Math.round(each / (12 * n)) : r.interval === "week" ? Math.round((each * 52) / (12 * n)) : Math.round(each / n);
  });
}

export function moneySummary({ balance, fees, invoices, subscriptions, payouts } = {}, now = Date.now()) {
  const { start, lastStart } = monthBounds(now);
  const net = (f) => (f.amount || 0) - (f.amount_refunded || 0);
  const feesThisMonthCents = sum((fees || []).filter((f) => f.created >= start), net);
  const feesLastMonthCents = sum((fees || []).filter((f) => f.created >= lastStart && f.created < start), net);
  const subsThisMonthCents = sum((invoices || []).filter((i) => i.created >= start), (i) => i.amount_paid);
  const subsLastMonthCents = sum((invoices || []).filter((i) => i.created >= lastStart && i.created < start), (i) => i.amount_paid);
  const active = (subscriptions || []).filter((s) => s.status === "active" || s.status === "past_due");
  return {
    availableCents: usd(balance?.available),
    pendingCents: usd(balance?.pending),
    feesThisMonthCents,
    feesLastMonthCents,
    subsThisMonthCents,
    subsLastMonthCents,
    thisMonthCents: feesThisMonthCents + subsThisMonthCents,
    lastMonthCents: feesLastMonthCents + subsLastMonthCents,
    mrrCents: sum(active, monthly),
    payingCount: active.length,
    onTheWayCents: sum((payouts || []).filter((p) => p.status === "in_transit" || p.status === "pending"), (p) => p.amount),
  };
}
