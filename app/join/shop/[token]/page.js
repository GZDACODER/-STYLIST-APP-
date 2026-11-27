// A shop owner's invite to take a chair (Shop → Add a chair, 0081 SQL).
// Logged in as a pro: Join. Otherwise: sign up or log in with the invited
// email, and the dashboard offers Join too.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/user";
import { createClient } from "@/lib/supabase/server";
import { loadInvite } from "@/lib/shopsServer";
import { JoinShopForm } from "@/app/(studio)/dashboard/shop/ShopForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join a shop", robots: { index: false, follow: false } };

export default async function JoinShopPage({ params }) {
  const { token } = await params;
  const invite = await loadInvite(token);
  if (!invite?.shop) notFound();
  const shop = invite.shop;
  const owner = shop.owner?.business_name || "The shop owner";
  const user = await getUser();
  let isPro = false;
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase.from("stylists").select("id").eq("id", user.id).maybeSingle();
    isPro = Boolean(data);
  }

  return (
    <section className="py-card" aria-labelledby="join-title">
      <header className="py-pro">
        <span className="py-avatar py-monogram" aria-hidden="true">
          {(shop.name.trim()[0] || "C").toUpperCase()}
        </span>
        <p className="py-kicker">Chair invite</p>
      </header>
      <h1 className="py-join-title" id="join-title">
        Join {shop.name}
      </h1>
      {invite.status !== "invited" ? (
        <p className="message info">
          {invite.status === "active" ? "This invite has been used." : "This invite was cancelled."} Ask {owner} for a new link if
          you need one.
        </p>
      ) : (
        <>
          <ul className="py-list">
            <li>Your own booking page, calendar and clients</li>
            <li>Card payments go straight to your own Stripe account</li>
            <li>{owner} pays for your Clientele plan</li>
          </ul>
          <div className="py-actions">
            {user && isPro ? (
              <JoinShopForm token={token} />
            ) : user ? (
              <p className="message info">
                Finish setting up your business first, then open this link again. <Link href="/dashboard">Continue</Link>
              </p>
            ) : (
              <>
                <Link className="py-btn py-btn-link" href="/signup">
                  Create your account
                </Link>
                <Link className="py-btn py-btn-link is-quiet" href="/login">
                  I have an account: log in
                </Link>
                <p className="py-secure">
                  Use {invite.invite_email ? <strong>{invite.invite_email}</strong> : "the email the invite was sent to"}. You&apos;ll see
                  Join on your dashboard.
                </p>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
