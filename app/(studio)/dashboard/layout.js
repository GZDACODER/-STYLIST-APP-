import { redirect } from "next/navigation";
import { Cormorant_Garamond } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import { BRAND_NAME } from "@/lib/brand";
import PlanBanner from "./PlanBanner";
import CreateStylistForm from "./CreateStylistForm";
import { getMyPlan } from "@/lib/plan";
import DashboardNav from "./DashboardNav";
import AssistantWidget from "./assistant/AssistantWidget";
import { PLANS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import GuideProvider from "@/components/guide/GuideProvider";
import { isDemo } from "@/lib/demo";
import "./dashboard.css";
import "./atelier.css";

// The same serif as the public booking page.
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

export const viewport = { themeColor: "#0E0E0E" };

// The dashboard's frame: a slim black sidebar (a bottom tab bar on phones
// and iPad portrait) and the page on warm ivory.
export default async function DashboardLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: stylist } = await supabase
    .from("stylists")
    .select("business_name")
    .eq("id", user.id)
    .maybeSingle();

  // Signed up as a stylist (the business name is on the login) but no
  // profile was made, for example because the email already had a login
  // from booking: make it now. Needs 0018_stylist_profile_repair.sql.
  const signupName = String(user.user_metadata?.business_name || "").trim();
  if (!stylist && signupName) {
    const { error } = await supabase.rpc("create_my_stylist", {
      p_business_name: signupName,
      p_first_name: String(user.user_metadata?.first_name || ""),
    });
    if (error) console.error("Couldn't repair stylist profile", error.code, error.message);
    ({ data: stylist } = await supabase
      .from("stylists")
      .select("business_name")
      .eq("id", user.id)
      .maybeSingle());
  }

  // The plan, and which first-visit tips they've seen (null before the
  // step 44 SQL is run: then only this phone remembers).
  const [plan, guidesSeen] = stylist
    ? await Promise.all([
        getMyPlan(supabase, user.id),
        Promise.resolve(supabase.from("onboarding_guides_seen").select("guide_key")).then(({ data, error }) =>
          error ? null : (data || []).map((r) => r.guide_key)
        ),
      ])
    : [null, null];
  // The pop-up Assistant: its button shows for every pro once it's switched
  // on for the app (ANTHROPIC_API_KEY in Vercel). Without it on their plan
  // (the add-on, or the free trial) it opens an "Add the Assistant" card
  // instead of the chat.
  const assistantOn = Boolean(stylist && process.env.ANTHROPIC_API_KEY);
  const assistantLocked = !plan?.has.assistant;
  let firstName = "";
  if (assistantOn) {
    const { data: nameRow } = await supabase.from("stylists").select("first_name").eq("id", user.id).maybeSingle();
    firstName = nameRow?.first_name || "";
  }

  // Clients who verified on a booking page have a login too, but no stylist
  // profile. They don't belong in the dashboard.
  if (!stylist) {
    return (
      <div className={`db ${display.variable}`}>
        <main className="db-main">
          <div className="db-page stack">
            <h1>Finish setting up your business</h1>
            <p className="muted">
              {user.email} isn&apos;t set up as a business yet. If you take bookings, add your
              business name below to finish. If you&apos;re booking an appointment, please use
              the booking link the business sent you instead.
            </p>
            <div className="card">
              <CreateStylistForm />
            </div>
            <form action={logout}>
              <button type="submit" className="button secondary">
                Log out
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <GuideProvider mode="pro" scope={user.id} initialSeen={guidesSeen}>
    <div className={`db ${display.variable}`}>
      <aside className="db-side">
        <div className="db-brand">
          <span className="db-brand-name">{stylist.business_name}</span>
          <span className="db-brand-mark">{BRAND_NAME}</span>
        </div>
        <DashboardNav />
        <div className="db-side-foot">
          <span className="db-side-email">{user.email}</span>
          <form action={logout}>
            <button type="submit" className="db-logout">
              Log out
            </button>
          </form>
        </div>
      </aside>

      {/* Phones and iPad portrait: a slim bar at the top (the nav moves to the bottom). */}
      <header className="db-topbar">
        <span className="db-brand-name">{stylist.business_name}</span>
        <form action={logout}>
          <button type="submit" className="db-logout">
            Log out
          </button>
        </form>
      </header>

      <main className="db-main">
        <div className="db-page">
          {isDemo(user) ? (
            <div className="demo-banner" role="note">
              <p>
                <strong>You&apos;re exploring Maison Demo</strong>, a sample salon. Tap around and try anything: it
                resets every night, and nothing is sent to real people.
              </p>
              <a href="/demo/exit" className="button small">
                Start your free trial
              </a>
            </div>
          ) : (
            <PlanBanner plan={plan} />
          )}
          {children}
        </div>
      </main>
      {assistantOn && (
        <AssistantWidget
          firstName={firstName}
          locked={assistantLocked}
          price={`${formatPrice(PLANS.assistant.monthlyCents).replace(/\.00$/, "")}/mo`}
        />
      )}
    </div>
    </GuideProvider>
  );
}
