// Admin > Pros: every pro account in one list. Search by name or email,
// filter by plan, and open one to see everything and act on it (founding
// pro, more free days, free account, email). Owner only (ADMIN_EMAILS).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/user";
import { isAdmin } from "@/lib/admin";
import { BRAND_NAME } from "@/lib/brand";
import { STAGES } from "@/lib/activation";
import PageHeader from "@/components/dash/PageHeader";
import EmptyState from "@/components/dash/EmptyState";
import { loadProsAdmin } from "./data";

export const metadata = { title: `Pros (admin) · ${BRAND_NAME}` };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "trial", label: "On trial" },
  { key: "founding", label: "Founding" },
  { key: "paying", label: "Paying" },
  { key: "free", label: "Free" },
  { key: "ended", label: "Trial ended" },
  { key: "stuck", label: "Stuck" },
  { key: "paused", label: "Paused" },
];

const match = (p, f) =>
  f === "all" ? true : f === "founding" ? p.founding : f === "stuck" ? p.stuck : f === "paused" ? p.paused : p.status.key === f;

const ago = (iso) => {
  if (!iso) return "never";
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

export default async function ProsPage({ searchParams }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) notFound();
  const { q = "", f = "all", tests } = await searchParams;
  const showTests = tests === "1";
  const { pros, error } = await loadProsAdmin();
  const base = showTests ? pros : pros.filter((p) => !p.test);
  const needle = String(q).trim().toLowerCase();
  const list = base
    .filter((p) => match(p, f))
    .filter((p) => !needle || [p.businessName, p.email, p.firstName, p.slug].some((x) => String(x || "").toLowerCase().includes(needle)));
  const hidden = pros.length - base.length;
  const href = (o) => {
    const sp = new URLSearchParams({ ...(q ? { q } : {}), ...(f !== "all" ? { f } : {}), ...(showTests ? { tests: "1" } : {}), ...o });
    for (const [k, v] of [...sp]) if (!v) sp.delete(k);
    const s = sp.toString();
    return `/dashboard/admin/pros${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        guide="admin_pros"
        eyebrow="Admin"
        title="Pros"
        subtitle={`${base.length} ${base.length === 1 ? "account" : "accounts"}${hidden ? ` · ${hidden} yours, demo or test hidden` : ""}. Open one to see everything and make changes.`}
        actions={
          <Link href={href({ tests: showTests ? "" : "1" })} className="button small secondary">
            {showTests ? "Hide test and demo" : "Show test and demo"}
          </Link>
        }
      />
      {error && <p className="message error">Couldn&apos;t load everything: {error.message}</p>}

      <form className="ap-search" action="/dashboard/admin/pros">
        <input type="search" name="q" defaultValue={q} placeholder="Search by business, name or email" aria-label="Search pros" />
        {f !== "all" && <input type="hidden" name="f" value={f} />}
        {showTests && <input type="hidden" name="tests" value="1" />}
        <button type="submit" className="button small">Search</button>
      </form>
      <nav className="segmented ap-filters" aria-label="Filter">
        {FILTERS.map((x) => {
          const n = base.filter((p) => match(p, x.key)).length;
          return (
            <Link key={x.key} href={href({ f: x.key === "all" ? "" : x.key })} className={f === x.key ? "active" : ""} aria-current={f === x.key ? "page" : undefined}>
              {x.label} ({n})
            </Link>
          );
        })}
      </nav>

      {list.length === 0 ? (
        <EmptyState title="No pros here" text={needle ? "Nobody matches that search." : "No accounts in this group yet."} />
      ) : (
        <section className="card ap-table-card">
          <table className="ap-table">
            <thead>
              <tr>
                <th>Pro</th>
                <th>Plan</th>
                <th>Setup</th>
                <th>Payouts</th>
                <th>Last login</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/dashboard/admin/pros/${p.id}`} className="ap-name">
                      {p.businessName}
                    </Link>
                    {p.you && <span className="badge">You</span>}
                    {!p.you && p.test && <span className="badge">Test</span>}
                    {p.paused && <span className="badge ap-paused">Paused</span>}
                    <span className="muted small-text ap-sub">{[p.email, p.trade].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className={`ap-plan is-${p.status.key}`}>{p.status.label}</td>
                  <td>
                    {STAGES[p.step].label}
                    {p.stuck && <span className="badge ap-stuck">Stuck {p.daysStuck}d</span>}
                  </td>
                  <td>{p.payouts === "on" ? "On" : p.payouts === "started" ? "Started" : "Off"}</td>
                  <td>{ago(p.lastSignInAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
