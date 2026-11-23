// The nightly autopilot's checks. Run from the repo root:
//   node scripts/nightly-check.mjs              prints the results as JSON
//   node scripts/nightly-check.mjs --save       also saves them as a report
//                                               in the Control Room
//   --extra file.json   adds {"summary", "needs_you": [], "fixed": []} to
//                       the saved report (what Claude fixed or found).
// Needs: the live site, Supabase's Management API (scripts/sb-sql.sh; the
// cloud environment adds the access token) and the gh command for CI.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const SITE = "https://www.clientelesuite.com";
const args = process.argv.slice(2);
const checks = [];
const add = (name, status, note = "") => checks.push({ name, status, note });

function sql(query) {
  const out = execFileSync("scripts/sb-sql.sh", [query], { encoding: "utf8", timeout: 60000 });
  return JSON.parse(out);
}

// 1. Database health numbers (supabase/migrations/0052_control_room.sql).
let stats = null;
try {
  stats = sql("select public.ops_stats() as s")[0].s;
  add("Database answers", "ok");
} catch (e) {
  add("Database answers", "fail", String(e.message).slice(0, 200));
}

if (stats) {
  const job = stats.job;
  const late = !job?.last_run || Date.now() - new Date(job.last_run).getTime() > 5 * 60000;
  add(
    "Every-minute job (reminders, waitlist, emails)",
    !job || late ? "fail" : stats.calls?.bad_1h || job.failed_1h ? "warn" : "ok",
    job ? `${stats.calls?.ok_1h ?? job.runs_1h}/60 good calls in the last hour` : "not running"
  );
  add("Errors in the last 24 hours", stats.errors_24h > 0 ? "warn" : "ok", `${stats.errors_24h}`);
  if (stats.email_log_ready) {
    const pct = Math.round((stats.emails_today / 100) * 100);
    add("Emails today (Resend free plan ~100/day)", pct >= 90 ? "fail" : pct >= 70 ? "warn" : "ok", `${stats.emails_today} sent today`);
    add("Emails that failed (24 hours)", stats.emails_failed_24h > 0 ? "warn" : "ok", `${stats.emails_failed_24h}`);
  }
  add("Aftercare emails on time", stats.after_visit_stuck > 0 ? "warn" : "ok", stats.after_visit_stuck ? `${stats.after_visit_stuck} late` : "");
  const dbPct = Math.round((stats.db_bytes / (500 * 1024 * 1024)) * 100);
  const stPct = Math.round((stats.storage_bytes / (1024 * 1024 * 1024)) * 100);
  add("Database size (free plan 500 MB)", dbPct >= 90 ? "fail" : dbPct >= 70 ? "warn" : "ok", `${dbPct}% used`);
  add("Photo storage (free plan 1 GB)", stPct >= 90 ? "fail" : stPct >= 70 ? "warn" : "ok", `${stPct}% used`);
  add("Growth", "ok", `${stats.pros} pros (${stats.pros_7d} new this week), ${stats.bookings_7d} bookings this week`);
}

// 2. The live site: key pages open without errors.
let ownSlug = null;
try {
  ownSlug = sql("select slug from public.stylists where pro_code = 'CL-TPNF'")[0]?.slug || null;
} catch {}
const pages = ["/", "/login", "/signup", "/forgot-password", "/client", "/sitemap.xml", "/robots.txt"];
if (ownSlug) pages.push(`/book/${ownSlug}`);
try {
  const { chromium, devices } = require("playwright");
  const browser = await chromium.launch();
  const context = await browser.newContext(devices["iPhone 13"]);
  for (const path of pages) {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      const res = await page.goto(SITE + path, { waitUntil: "networkidle", timeout: 45000 });
      const code = res?.status() ?? 0;
      add(`Page ${path}`, code >= 200 && code < 400 && !errors.length ? "ok" : "fail", code >= 400 || !code ? `HTTP ${code}` : errors.join("; ").slice(0, 200));
    } catch (e) {
      add(`Page ${path}`, "fail", String(e.message).split("\n")[0].slice(0, 200));
    }
    await page.close();
  }
  await browser.close();
} catch (e) {
  add("Browser check", "warn", `Couldn't start the browser: ${String(e.message).split("\n")[0]}`);
}

// 3. The latest code on main passed its checks (and so deployed).
try {
  const state = execFileSync("gh", ["api", "repos/GZDACODER/-STYLIST-APP-/commits/main/status", "--jq", ".state"], {
    encoding: "utf8",
    timeout: 30000,
  }).trim();
  add("Latest update passed checks", state === "success" ? "ok" : state === "pending" ? "warn" : "fail", state);
} catch (e) {
  add("Latest update passed checks", "warn", "Couldn't ask GitHub");
}

const rank = { ok: 0, warn: 1, fail: 2 };
const status = checks.reduce((worst, c) => (rank[c.status] > rank[worst] ? c.status : worst), "ok");
const bad = checks.filter((c) => c.status !== "ok");
const result = {
  status,
  summary: bad.length
    ? `${bad.length} of ${checks.length} checks need a look: ${bad.map((c) => c.name).join(", ")}.`
    : `All ${checks.length} checks passed.`,
  checks,
};

if (args.includes("--save")) {
  let extra = {};
  const i = args.indexOf("--extra");
  if (i >= 0 && args[i + 1]) extra = JSON.parse(readFileSync(args[i + 1], "utf8"));
  const report = {
    status: extra.status || status,
    summary: String(extra.summary || result.summary).slice(0, 2000),
    checks,
    needs_you: extra.needs_you || [],
    fixed: extra.fixed || [],
  };
  const lit = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  sql(
    `insert into public.ops_reports (status, summary, checks, needs_you, fixed) values (` +
      `'${report.status}', '${report.summary.replace(/'/g, "''")}', ${lit(report.checks)}::jsonb, ${lit(report.needs_you)}::jsonb, ${lit(report.fixed)}::jsonb)`
  );
  result.saved = true;
}

console.log(JSON.stringify(result, null, 2));
