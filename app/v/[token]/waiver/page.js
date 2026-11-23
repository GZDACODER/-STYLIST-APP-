// /v/<code>/waiver: sign the pro's form and waiver before the visit, from
// the "Manage my appointment" link (no sign-in).
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadVisitForManage } from "@/lib/manageLink";
import WaiverForm from "./WaiverForm";

export const dynamic = "force-dynamic";

export default async function WaiverPage({ params }) {
  const { token } = await params;
  const v = await loadVisitForManage(token);
  if (!v) notFound();
  const { data: w } = await createAdminClient().rpc("waiver_for_visit", { p_token: token });
  return (
    <div className="mv">
      <p className="bk-kicker">{v.stylist.business_name}</p>
      <h1 className="cl-title">Your form and waiver</h1>
      {!w?.has_form ? (
        <p className="message info">There&apos;s nothing to sign for this {v.words.appointment}.</p>
      ) : !w.needed ? (
        <p className="message success">You&apos;ve already signed. You&apos;re all set.</p>
      ) : !v.upcoming ? (
        <p className="message info">This {v.words.appointment} has passed.</p>
      ) : (
        <WaiverForm token={token} intake={{ questions: w.questions || [], waiver_text: w.waiver_text }} businessName={v.stylist.business_name} />
      )}
      <p className="muted small-text">
        <Link href={`/v/${token}`}>‹ Back to my {v.words.appointment}</Link>
      </p>
    </div>
  );
}
