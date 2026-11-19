// "My Pros" (clientelesuite.com/my): a client's appointments with every
// business they book on Clientele. Sign in with the same email (or text)
// code as the booking pages. Each pro shows the next appointment (Manage
// opens their booking page, with Reschedule and Cancel), the last visit,
// and "Book again", which opens their page with that service picked.
// Can be added to a phone's home screen (app.webmanifest).
import { createBookingClient } from "@/lib/supabase/booking";
import { displayPhone, textCodesEnabled } from "@/lib/phone";
import { maskEmail } from "@/lib/maskEmail";
import MySignIn from "./MySignIn";
import SignOut from "./SignOut";
import AddToHome from "./AddToHome";
import ProCard from "./ProCard";

export const metadata = {
  title: "My Pros",
  description: "Your appointments with every pro you book on Clientele.",
  manifest: "/my/app.webmanifest",
  appleWebApp: { capable: true, title: "My Pros", statusBarStyle: "default" },
  robots: { index: false },
};

export default async function MyProsPage() {
  const supabase = await createBookingClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const textCodes = textCodesEnabled();

  // Not signed in on this phone yet.
  if (!user || (!user.email && !user.phone)) {
    return (
      <div className="my-wrap">
        <header className="my-head">
          <p className="bk-kicker">Every pro, one place</p>
          <h1>My Pros</h1>
          <p className="bk-lede">
            Your appointments with every pro you book on Clientele, and a quick way to book again.
          </p>
        </header>
        <section className="card">
          <h2>Confirm your {textCodes ? "phone number" : "email"}</h2>
          <p className="muted">
            Use the {textCodes ? "number" : "email"} you book with. We&apos;ll send you a code.
          </p>
          <MySignIn textCodes={textCodes} />
        </section>
      </div>
    );
  }

  const [{ data: pros, error }, { data: extraRows }] = await Promise.all([
    supabase.rpc("get_my_pros"),
    // Deposits to pay, standing visits and waitlists (step 40 SQL; empty before it's run).
    supabase.rpc("get_my_pro_extras"),
  ]);
  const extrasBySlug = {};
  for (const x of extraRows || []) (extrasBySlug[x.slug] ||= []).push(x);
  const who = user.phone ? displayPhone(user.phone) : maskEmail(user.email);
  const list = pros || [];
  // Pros they're only waitlisted with (no bookings yet) get a card too.
  const listed = new Set(list.map((p) => p.slug));
  const waitOnly = Object.entries(extrasBySlug)
    .filter(([slug]) => !listed.has(slug))
    .map(([slug, rows]) => ({ slug, business_name: rows[0].business_name, upcoming_count: 0, visits: 0 }));

  return (
    <div className="my-wrap">
      <header className="my-head">
        <p className="bk-kicker">Every pro, one place</p>
        <h1>My Pros</h1>
        <p className="muted small-text">
          Signed in as {who} · <SignOut label="Not you?" />
        </p>
      </header>

      {error && (
        <p className="message error">Your pros couldn&apos;t load right now. Please try again in a minute.</p>
      )}

      {!error && list.length === 0 && waitOnly.length === 0 && (
        <section className="card">
          <h2>No appointments yet</h2>
          <p className="muted">
            Nothing is booked with {who} yet. When you book with a pro on Clientele using this{" "}
            {user.phone ? "number" : "email"}, they&apos;ll show up here. Booked with a different{" "}
            {user.phone ? "number" : "email"}? <SignOut label="Switch" />
          </p>
        </section>
      )}

      {list.length > 0 && (
        <ul className="my-pros">
          {list.map((pro) => (
            <ProCard key={pro.slug} pro={pro} extras={extrasBySlug[pro.slug]} />
          ))}
        </ul>
      )}

      {waitOnly.length > 0 && (
        <ul className="my-pros">
          {waitOnly.map((pro) => (
            <ProCard key={pro.slug} pro={pro} extras={extrasBySlug[pro.slug]} />
          ))}
        </ul>
      )}

      <AddToHome />
    </div>
  );
}
