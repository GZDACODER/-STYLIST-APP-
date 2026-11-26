// Your signed Clientele agreement(s), with PDFs (Settings > Plan & billing).
import { getUser } from "@/lib/supabase/user";
import { createClient } from "@/lib/supabase/server";

const when = (iso) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export async function AgreementsSection() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;
  const { data: rows } = await supabase
    .from("pro_agreements")
    .select("id, version, signed_at, legal_name, business_name, pdf_path")
    .eq("stylist_id", user.id)
    .order("signed_at", { ascending: false });
  return (
    <>
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
    </>
  );
}
