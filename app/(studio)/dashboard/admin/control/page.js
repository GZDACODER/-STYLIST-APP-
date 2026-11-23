// The Control Room: everything Clientele runs on, on one page, for the owner
// (ADMIN_EMAILS). Each service gets a status (fine / look at it / broken),
// with usage against the free-plan limits, growth, and the nightly
// autopilot's reports (supabase/migrations/0052_control_room.sql).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { BRAND_NAME } from "@/lib/brand";
import PageHeader from "@/components/dash/PageHeader";
import ControlTabs from "./ControlTabs";

export const metadata = { title: `Control Room · ${BRAND_NAME}` };
export const dynamic = "force-dynamic";

const MB = 1024 * 1024;
// Supabase's free plan: 500 MB database, 1 GB file storage.
const DB_LIMIT = 500 * MB;
const STORAGE_LIMIT = 1024 * MB;

function ago(iso) {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

const when = (iso) =>
  new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

const size = (bytes) => (bytes >= 1024 * MB ? `${(bytes / 1024 / MB).toFixed(1)} GB` : `${Math.max(0.1, bytes / MB).toFixed(1)} MB`);

const WORD = { ok: "Fine", warn: "Look at it", fail: "Broken" };

function Tile({ t }) {
  const body = (
    <>
      <span className="cr-tile-head">
        <span className={`cr-dot ${t.status}`} aria-hidden="true" />
        <span className="db-label">{t.name}</span>
        <span className={`cr-word ${t.status}`}>{WORD[t.status]}</span>
      </span>
      <strong className="home-card-value">{t.value}</strong>
      <span className="muted small-text">{t.note}</span>
    </>
  );
  return t.href ? (
    <Link href={t.href} className={`home-card cr-tile is-${t.status}`}>
      {body}
    </Link>
  ) : (
    <div className={`home-card cr-tile is-${t.status}`}>{body}</div>
  );
}

function Meter({ label, used, limit, note }) {
  const pct = Math.min(100, (used / limit) * 100);
  const status = pct >= 90 ? "fail" : pct >= 70 ? "warn" : "ok";
  return (
    <div className="cr-meter-row">
      <div className="cr-meter-text">
        <span>{label}</span>
        <span className="muted small-text">
          {size(used)} of {size(limit)} · {pct < 1 ? "under 1" : Math.round(pct)}%
        </span>
      </div>
      <div className={`cr-meter ${status}`} aria-hidden="true">
        <span style={{ width: `${Math.max(pct, 0.6)}%` }} />
      </div>
      {note && <p className="muted small-text">{note}</p>}
    </div>
  );
}

export default async function ControlRoomPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) notFound();

  const admin = createAdminClient();
  const started = Date.now();
  const [{ data: stats, error: statsError }, { data: reports, error: reportsError }] = await Promise.all([
    admin.rpc("ops_stats"),
    admin.from("ops_reports").select("*").order("created_at", { ascending: false }).limit(14),
  ]);
  const dbMs = Date.now() - started;
  const s = stats || {};

  const env = process.env;
  const sha = (env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);
  // "Merge pull request #117 from owner/branch" reads as "update #117".
  const rawCommit = (env.VERCEL_GIT_COMMIT_MESSAGE || "").split("\n")[0];
  const prNumber = rawCommit.match(/^Merge pull request #(\d+)/)?.[1];
  const commit = prNumber ? `update #${prNumber}` : rawCommit;
  const stripeKey = env.STRIPE_SECRET_KEY || "";
  const stripeLive = stripeKey.startsWith("sk_live") || stripeKey.startsWith("rk_live");

  const job = s.job || null;
  const calls = s.calls || null;
  const jobLate = !job?.last_run || Date.now() - new Date(job.last_run).getTime() > 5 * 60000;
  const jobStatus = !job ? "fail" : jobLate ? "fail" : (calls?.bad_1h || 0) > 0 || (job.failed_1h || 0) > 0 ? "warn" : "ok";
  const emailOn = Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);

  const tiles = [
    {
      name: "Website",
      status: "ok",
      value: "Live",
      note: sha ? `Vercel · ${commit ? commit.slice(0, 60) : `version ${sha}`}` : `Vercel · ${env.VERCEL_ENV || "local"}`,
    },
    {
      name: "Database",
      status: statsError ? "fail" : dbMs > 2500 ? "warn" : "ok",
      value: statsError ? "No answer" : `${dbMs} ms`,
      note: statsError ? `Supabase: ${statsError.message.slice(0, 80)}` : "Supabase answered",
    },
    {
      name: "Every-minute job",
      status: jobStatus,
      value: job ? `${calls?.ok_1h ?? job.runs_1h}/60` : "Not running",
      note: job
        ? `Reminders, waitlist and emails · last run ${ago(job.last_run)}${calls?.bad_1h ? ` · ${calls.bad_1h} failed calls this hour` : ""}`
        : "Run supabase/waitlist_every_minute.sql",
    },
    {
      name: "Emails",
      status: !emailOn ? "fail" : (s.after_visit_stuck || 0) > 0 ? "warn" : "ok",
      value: !emailOn ? "Off" : s.after_visit_stuck ? `${s.after_visit_stuck} late` : "Sending",
      note: emailOn ? `Resend · last aftercare email ${ago(s.last_after_visit)}` : "RESEND_API_KEY or EMAIL_FROM missing in Vercel",
    },
    {
      name: "Payments",
      status: !stripeKey || !env.STRIPE_WEBHOOK_SECRET ? "fail" : stripeLive ? "ok" : "warn",
      value: !stripeKey ? "Off" : stripeLive ? "Live" : "Test mode",
      note: !stripeKey
        ? "STRIPE_SECRET_KEY missing in Vercel"
        : !env.STRIPE_WEBHOOK_SECRET
          ? "STRIPE_WEBHOOK_SECRET missing in Vercel"
          : stripeLive
            ? "Stripe · real payments"
            : "Stripe sandbox · switch to live before charging",
    },
    {
      name: "Errors",
      status: (s.errors_24h || 0) > 0 ? "warn" : "ok",
      value: String(s.errors_24h ?? "—"),
      note: "In the last 24 hours · emailed as they happen",
      href: "/dashboard/admin/errors",
    },
    {
      name: "Text messages",
      status: env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM ? "ok" : "warn",
      value: env.TWILIO_ACCOUNT_SID ? "On" : "Not set up",
      note: env.TWILIO_ACCOUNT_SID ? "Twilio" : "Twilio · on your to-do list",
    },
    {
      name: "Assistant",
      status: env.ANTHROPIC_API_KEY ? "ok" : "warn",
      value: env.ANTHROPIC_API_KEY ? "On" : "Off",
      note: "Claude for pros who add it",
    },
  ];

  const problems = tiles.filter((t) => t.status === "fail").length;
  const warnings = tiles.filter((t) => t.status === "warn").length;
  const headline = problems
    ? `${problems} ${problems === 1 ? "thing is" : "things are"} broken`
    : warnings
      ? `Running · ${warnings} to look at`
      : "Everything is running";

  const list = reports || [];
  const latest = list[0];

  return (
    <>
      <PageHeader
        hero
        eyebrow="Control Room"
        title={headline}
        subtitle={`Checked ${when(new Date().toISOString())} Central · refresh to check again`}
      />

      <ControlTabs active="health" />

      <section className="cr-grid" aria-label="Services">
        {tiles.map((t) => (
          <Tile key={t.name} t={t} />
        ))}
      </section>

      <div className="home-grid">
        <section className="card">
          <h2>Nightly autopilot</h2>
          {reportsError ? (
            <p className="message error">Couldn&apos;t load reports: {reportsError.message}</p>
          ) : !latest ? (
            <p className="muted">
              No report yet. Claude checks everything each night, fixes small problems and writes the report here.
            </p>
          ) : (
            <>
              <p className="cr-report-head">
                <span className={`cr-dot ${latest.status}`} aria-hidden="true" />
                <strong>{WORD[latest.status]}</strong>
                <span className="muted small-text">{when(latest.created_at)}</span>
              </p>
              <p>{latest.summary}</p>
              {Array.isArray(latest.needs_you) && latest.needs_you.length > 0 && (
                <>
                  <p className="db-label">Needs you</p>
                  <ul className="cr-list">
                    {latest.needs_you.map((x, i) => (
                      <li key={i}>{String(x)}</li>
                    ))}
                  </ul>
                </>
              )}
              {Array.isArray(latest.fixed) && latest.fixed.length > 0 && (
                <>
                  <p className="db-label">Fixed for you</p>
                  <ul className="cr-list">
                    {latest.fixed.map((x, i) => (
                      <li key={i}>{String(x)}</li>
                    ))}
                  </ul>
                </>
              )}
              {Array.isArray(latest.checks) && latest.checks.length > 0 && (
                <details>
                  <summary className="small-text">All {latest.checks.length} checks</summary>
                  <ul className="cr-checks">
                    {latest.checks.map((c, i) => (
                      <li key={i}>
                        <span className={`cr-dot ${c.status || "ok"}`} aria-hidden="true" />
                        <span>{c.name}</span>
                        {c.note && <span className="muted small-text"> · {c.note}</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {list.length > 1 && (
                <p className="cr-history" aria-label="Last two weeks">
                  {list
                    .slice()
                    .reverse()
                    .map((r) => (
                      <span key={r.id} className={`cr-dot ${r.status}`} title={`${when(r.created_at)}: ${WORD[r.status]}`} />
                    ))}
                  <span className="muted small-text">last {list.length} nights</span>
                </p>
              )}
            </>
          )}
        </section>

        <section className="card">
          <h2>Plan limits</h2>
          <Meter label="Database" used={s.db_bytes || 0} limit={DB_LIMIT} note="Supabase free plan: 500 MB. Pro: 8 GB." />
          <Meter
            label={`Photos (${s.photos ?? 0})`}
            used={s.storage_bytes || 0}
            limit={STORAGE_LIMIT}
            note="Supabase free plan: 1 GB. Pro: 100 GB."
          />
          <p className="muted small-text">
            Emails: Resend&apos;s free plan sends about 100 a day. See your plans list in LAUNCH_READINESS.md.
          </p>
        </section>
      </div>

      <section className="card">
        <h2>Growth</h2>
        <div className="cr-figures">
          <div>
            <span className="db-label">Pros</span>
            <strong className="home-card-value">{s.pros ?? "—"}</strong>
            <span className="muted small-text">{s.pros_7d ?? 0} new this week</span>
          </div>
          <div>
            <span className="db-label">Bookings this week</span>
            <strong className="home-card-value">{s.bookings_7d ?? "—"}</strong>
            <span className="muted small-text">{s.bookings_upcoming ?? 0} coming up</span>
          </div>
          <div>
            <span className="db-label">Clients</span>
            <strong className="home-card-value">{s.clients ?? "—"}</strong>
            <span className="muted small-text">across every pro</span>
          </div>
        </div>
      </section>

      <p className="muted small-text">
        <Link href="/dashboard/admin/errors">Errors</Link> · <Link href="/dashboard/admin/disputes">Disputes</Link> ·{" "}
        <Link href="/dashboard/admin/feedback">Trial feedback</Link> · <Link href="/dashboard/admin/check">Admin check</Link>
      </p>
    </>
  );
}
