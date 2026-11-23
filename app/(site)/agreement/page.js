// The Clientele agreement (layer 1): every pro signs it before using the
// dashboard, and again whenever its version changes (lib/agreements.js).
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import { PRO_TERMS, PRO_TERMS_VERSION } from "@/lib/agreements";
import { isDemo } from "@/lib/demo";
import AgreementForm from "./AgreementForm";

export const metadata = { title: `Your agreement · ${BRAND_NAME}`, robots: { index: false } };

export default async function AgreementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (isDemo(user)) redirect("/dashboard");
  const [{ data: stylist }, { data: signed }] = await Promise.all([
    supabase.from("stylists").select("business_name").eq("id", user.id).maybeSingle(),
    supabase.from("pro_agreements").select("version").eq("stylist_id", user.id).eq("kind", "pro_terms").gte("version", PRO_TERMS_VERSION).limit(1),
  ]);
  if (signed?.length) redirect("/dashboard");
  const updated = await supabase.from("pro_agreements").select("id").eq("stylist_id", user.id).limit(1);

  return (
    <>
      <p className="au-kicker">{updated.data?.length ? "Updated terms" : "One last step"}</p>
      <h1>{PRO_TERMS.title}</h1>
      <p className="muted">{PRO_TERMS.intro}</p>
      <ol className="agree-points">
        {PRO_TERMS.points.map((p) => (
          <li key={p.head}>
            <strong>{p.head}</strong>
            <span>{p.text}</span>
          </li>
        ))}
      </ol>
      <p className="small-text">
        Read the full{" "}
        <Link href="/terms" target="_blank">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" target="_blank">
          Privacy Policy
        </Link>
        .
      </p>
      <div className="card">
        <AgreementForm businessName={stylist?.business_name || ""} />
      </div>
      <p className="muted small-text">You&apos;ll get a PDF copy by email, and it&apos;s kept in your Settings.</p>
    </>
  );
}
