// Settings → Agreements: the pro's signed Clientele agreement(s), with PDFs.
import { redirect } from "next/navigation";
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: `Agreements · ${BRAND_NAME}` };

const when = (iso) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: rows } = await supabase
    .from("pro_agreements")
    .select("id, version, signed_at, legal_name, business_name, pdf_path")
    .eq("stylist_id", user.id)
    .order("signed_at", { ascending: false });

  return (
    <SettingsShell active="agreements" subtitle="Everything you've signed with Clientele.">
      <section className="card">
        <h2>Your Clientele agreement</h2>
        {(rows || []).length === 0 ? (
          <p className="muted">Nothing signed yet.</p>
        ) : (
          <ul className="cr-accounts">
            {rows.map((r) => (
              <li key={r.id}>
                <span>
                  <strong>Version {r.version}</strong>
                  <span className="muted small-text">
                    {" "}
                    · signed {when(r.signed_at)} by {r.legal_name} for {r.business_name}
                  </span>
                </span>
                {r.pdf_path && (
                  <a href={`/dashboard/agreement-pdf/${r.id}`} className="button small secondary" target="_blank" rel="noreferrer">
                    PDF
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="muted small-text">
          Client waivers you collect will show on each client&apos;s card.
        </p>
      </section>
    </SettingsShell>
  );
}
