// Admin > Briefings: what Clientele's AI agents wrote (agent_reports, 0079
// SQL). Chief of staff every Monday, Marketing & sales Tuesdays and Fridays,
// Growth strategist on the 1st. Newest first; ?agent= filters, ?id= opens one.
// Owner only (ADMIN_EMAILS).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/user";
import { isAdmin } from "@/lib/admin";
import { BRAND_NAME } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import PageHeader from "@/components/dash/PageHeader";
import EmptyState from "@/components/dash/EmptyState";

export const metadata = { title: `Briefings (admin) · ${BRAND_NAME}` };
export const dynamic = "force-dynamic";

const AGENTS = [
  { key: "", label: "All" },
  { key: "chief_of_staff", label: "Chief of staff", when: "Mondays" },
  { key: "marketing", label: "Marketing & sales", when: "Tue & Fri" },
  { key: "growth", label: "Growth strategist", when: "1st of the month" },
];
const LABEL = Object.fromEntries(AGENTS.map((a) => [a.key, a.label]));
const date = (iso) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

export default async function BriefingsPage({ searchParams }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) notFound();
  const { agent = "", id = "" } = await searchParams;
  const admin = createAdminClient();
  let q = admin.from("agent_reports").select("id, agent, title, created_at").order("created_at", { ascending: false }).limit(40);
  if (LABEL[agent] && agent) q = q.eq("agent", agent);
  const { data: rows, error } = await q;
  const openId = /^[0-9a-f-]{36}$/i.test(id) ? id : rows?.[0]?.id;
  const { data: open } = openId ? await admin.from("agent_reports").select("id, agent, title, body, created_at").eq("id", openId).maybeSingle() : { data: null };

  return (
    <>
      <PageHeader
        guide="admin_briefings"
        eyebrow="Admin"
        title="Briefings"
        subtitle="Reports from your AI team: Chief of staff (Mondays), Marketing & sales (Tue & Fri), Growth strategist (1st of the month). They draft; nothing is sent or posted without you."
      />
      <nav className="segmented ap-filters" aria-label="Agent">
        {AGENTS.map((a) => (
          <Link key={a.key || "all"} href={a.key ? `/dashboard/admin/briefings?agent=${a.key}` : "/dashboard/admin/briefings"} className={agent === a.key ? "active" : ""}>
            {a.label}
          </Link>
        ))}
      </nav>
      {error && <p className="message error">Couldn&apos;t load briefings: {error.message}</p>}
      {!error && !(rows || []).length ? (
        <EmptyState title="No briefings yet" text="The first Chief of staff briefing arrives Monday morning. You'll also get it by email." />
      ) : (
        <div className="ap-cols br-cols">
          <section className="card">
            <h2>Reports</h2>
            <ul className="ap-log">
              {(rows || []).map((r) => (
                <li key={r.id} className={r.id === open?.id ? "br-on" : ""}>
                  <Link href={`/dashboard/admin/briefings?${agent ? `agent=${agent}&` : ""}id=${r.id}`}>
                    <span className="ap-log-when">{date(r.created_at)}</span> <strong>{LABEL[r.agent]}</strong> · {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          {open && (
            <section className="card br-report">
              <p className="muted small-text">
                {LABEL[open.agent]} · {date(open.created_at)}
              </p>
              <h2>{open.title}</h2>
              <div className="br-body">{open.body}</div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
