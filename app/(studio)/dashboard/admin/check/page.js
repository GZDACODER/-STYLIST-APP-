// Says whether ADMIN_EMAILS is set on this deployment and whether the person
// looking is on it, without showing the addresses. For setting up the admin
// pages (any logged-in pro can open it; it reveals nothing about others).
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { adminEmails, isAdmin } from "@/lib/admin";
import { BRAND_NAME } from "@/lib/brand";
import PageHeader from "@/components/dash/PageHeader";

export const metadata = { title: `Admin check · ${BRAND_NAME}` };

export default async function AdminCheckPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const count = adminEmails().length;
  const admin = isAdmin(user);
  const env = process.env.VERCEL_ENV || "local";

  return (
    <>
      <PageHeader title="Admin check" subtitle="Who can see the admin pages on this site." />
      <section className="card stack">
        <p>
          <strong>ADMIN_EMAILS on this site:</strong>{" "}
          {count ? `set (${count} ${count === 1 ? "address" : "addresses"})` : "not set"}
        </p>
        <p>
          <strong>Your login ({user.email}):</strong> {admin ? "is an admin ✓" : "is not on the list"}
        </p>
        <p className="muted small-text">This copy of the site: {env}.</p>
        {admin ? (
          <p>
            <Link href="/dashboard/admin/errors">Errors</Link> · <Link href="/dashboard/admin/disputes">Disputes</Link> ·{" "}
            <Link href="/dashboard/admin/feedback">Trial feedback</Link>
          </p>
        ) : (
          <p className="muted">
            In Vercel, set ADMIN_EMAILS to {count ? "include " : ""}your login email for the <strong>Production</strong> environment, then redeploy the
            deployment marked <strong>Production</strong> (not a Preview).
          </p>
        )}
      </section>
    </>
  );
}
