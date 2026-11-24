// Projects (step 67 SQL): multi-session pieces, each with its sessions.
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import PageHeader from "@/components/dash/PageHeader";
import EmptyState from "@/components/dash/EmptyState";
import { NewProjectForm, STATUS_LABEL } from "./ProjectForms";

export const metadata = { title: `Projects · ${BRAND_NAME}` };

export default async function ProjectsPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { show } = await searchParams;
  const done = show === "done";
  const [{ data: projects, error }, { data: clients }, { data: links }] = await Promise.all([
    supabase.from("projects").select("id, title, client_name, placement, sessions_planned, status, updated_at").order("updated_at", { ascending: false }).limit(300),
    supabase.from("clients").select("id, name").order("name").limit(3000),
    supabase.from("bookings").select("project_id, booking_date, status, outcome").not("project_id", "is", null).limit(5000),
  ]);
  const all = projects || [];
  const list = all.filter((p) => (done ? p.status === "done" : p.status !== "done"));
  const today = new Date().toISOString().slice(0, 10);
  const countOf = {};
  for (const b of links || []) {
    if (b.status !== "confirmed" || b.outcome === "no_show") continue;
    const c = (countOf[b.project_id] ||= { done: 0, booked: 0 });
    if (b.booking_date <= today) c.done += 1;
    else c.booked += 1;
  }

  return (
    <>
      <PageHeader guide="projects" title="Projects" subtitle="Multi-session pieces, with every session in one place." />
      {error && <p className="message error">Projects aren&apos;t set up yet (step 67 SQL).</p>}
      <nav className="cr-tabs" aria-label="Projects">
        <a href="/dashboard/projects" className={!done ? "cr-tab active" : "cr-tab"}>
          Current ({all.filter((p) => p.status !== "done").length})
        </a>
        <a href="/dashboard/projects?show=done" className={done ? "cr-tab active" : "cr-tab"}>
          Done ({all.filter((p) => p.status === "done").length})
        </a>
      </nav>
      {list.length === 0 ? (
        <EmptyState title={done ? "No finished projects yet" : "No projects yet"} text="Start one below for a sleeve, back piece or anything that takes more than one session." />
      ) : (
        <ul className="rq-list">
          {list.map((p) => {
            const c = countOf[p.id] || { done: 0, booked: 0 };
            return (
              <li key={p.id} className="card">
                <Link href={`/dashboard/projects/${p.id}`} className="pj-link">
                  <p className="rq-head">
                    <span>
                      {p.title} · {p.client_name}
                    </span>
                    <span className="badge">{STATUS_LABEL[p.status]}</span>
                  </p>
                  <p className="muted small-text">
                    {p.placement ? `${p.placement} · ` : ""}
                    {c.done} {p.sessions_planned ? `of ${p.sessions_planned} ` : ""}
                    {c.done === 1 && !p.sessions_planned ? "session" : "sessions"} done{c.booked ? ` · ${c.booked} booked` : ""}
                  </p>
                  {p.sessions_planned ? (
                    <span className="pj-bar" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, (c.done / p.sessions_planned) * 100)}%` }} />
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <section className="card" id="new-project">
        <h2>Start a project</h2>
        {(clients || []).length ? <NewProjectForm clients={clients} /> : <p className="muted small-text">Add the client first in Clients.</p>}
      </section>
    </>
  );
}
