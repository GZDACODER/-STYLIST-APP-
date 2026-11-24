// One project: its details, its sessions, and the client's other bookings
// to add to it.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import { clockTime, formatDate } from "@/lib/availability";
import PageHeader from "@/components/dash/PageHeader";
import SubmitButton from "@/components/SubmitButton";
import { EditProjectForm } from "../ProjectForms";
import { deleteProject, linkSession } from "../actions";

export const metadata = { title: `Project · ${BRAND_NAME}` };

export default async function ProjectPage({ params }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const [{ data: sessions }, { data: other }] = await Promise.all([
    supabase.from("bookings").select("id, booking_date, start_time, service_name, status, outcome, visit_note, healing_sent").eq("project_id", p.id).order("booking_date").order("start_time"),
    p.client_id
      ? supabase.from("bookings").select("id, booking_date, start_time, service_name, status").eq("client_id", p.client_id).is("project_id", null).eq("status", "confirmed").order("booking_date", { ascending: false }).limit(20)
      : { data: [] },
  ]);
  const kept = (sessions || []).filter((s) => s.status === "confirmed" && s.outcome !== "no_show");

  return (
    <>
      <p className="small-text">
        <Link href="/dashboard/projects">‹ Projects</Link>
      </p>
      <PageHeader guide="projects" title={p.title} subtitle={`${p.client_name}${p.placement ? ` · ${p.placement}` : ""}`} />
      <section className="card">
        <h2>Sessions</h2>
        {kept.length === 0 ? (
          <p className="muted small-text">No sessions yet. Add the client&apos;s bookings below.</p>
        ) : (
          <ol className="pj-sessions">
            {kept.map((s, i) => (
              <li key={s.id}>
                <p className="rq-head">
                  <span>
                    Session {i + 1}
                    {p.sessions_planned ? ` of ${p.sessions_planned}` : ""} · {formatDate(s.booking_date)} {clockTime(s.start_time)}
                  </span>
                  <form action={linkSession}>
                    <input type="hidden" name="project_id" value={p.id} />
                    <input type="hidden" name="booking_id" value={s.id} />
                    <input type="hidden" name="on" value="false" />
                    <SubmitButton className="link-button small-text" pendingText="...">
                      Remove
                    </SubmitButton>
                  </form>
                </p>
                <p className="muted small-text">
                  {s.service_name}
                  {s.healing_sent ? ` · healing check-in day ${s.healing_sent} sent` : ""}
                </p>
                {s.visit_note && <p className="small-text">{s.visit_note}</p>}
              </li>
            ))}
          </ol>
        )}
        {(other || []).length > 0 && (
          <>
            <h3 className="pj-sub">Add a booking to this project</h3>
            <ul className="rq-list">
              {other.map((b) => (
                <li key={b.id} className="mn-row">
                  <p className="rq-head">
                    <span>
                      {formatDate(b.booking_date)} {clockTime(b.start_time)} · {b.service_name}
                    </span>
                    <form action={linkSession}>
                      <input type="hidden" name="project_id" value={p.id} />
                      <input type="hidden" name="booking_id" value={b.id} />
                      <input type="hidden" name="on" value="true" />
                      <SubmitButton className="button small secondary" pendingText="Adding...">
                        Add
                      </SubmitButton>
                    </form>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section className="card">
        <h2>Details</h2>
        <EditProjectForm p={p} />
      </section>
      <form action={deleteProject} className="pj-delete">
        <input type="hidden" name="id" value={p.id} />
        <SubmitButton className="link-button small-text" pendingText="Deleting...">
          Delete project (its bookings stay)
        </SubmitButton>
      </form>
    </>
  );
}
