import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Cormorant_Garamond } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import PlanBanner from "./PlanBanner";
import CreateStylistForm from "./CreateStylistForm";
import { getMyPlan } from "@/lib/plan";
import AppShell from "./shell/AppShell";
import AssistantWidget from "./assistant/AssistantWidget";
import { PLANS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import GuideProvider from "@/components/guide/GuideProvider";
import { isDemo } from "@/lib/demo";
import { PRO_TERMS_VERSION } from "@/lib/agreements";
import { TemplateProvider } from "@/components/TemplateContext";
import { getMyTemplate } from "@/lib/templates/server";
import "./dashboard.css";
import "./atelier.css";
import "./shell/shell.css";

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
    .select("business_name, slug")
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
      .select("business_name, slug")
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

  // The Clientele agreement (step 54 SQL): signed before using the dashboard,
  // and again when its version changes. Demo accounts are exempt.
  if (!isDemo(user)) {
    const { data: signedTerms, error: termsError } = await supabase
      .from("pro_agreements")
      .select("id")
      .eq("stylist_id", user.id)
      .eq("kind", "pro_terms")
      .gte("version", PRO_TERMS_VERSION)
      .limit(1);
    if (!termsError && !signedTerms?.length) redirect("/agreement");
  }

  // The pro's business-type template: words and which features are on.
  const tpl = await getMyTemplate();
  // The owner previewing a business type from the Control Room.
  const hasReturn = Boolean((await cookies()).get("cl_admin_return")?.value);
  const previewing = isDemo(user) && hasReturn;
  // The owner inside one of their own extra accounts (Control Room > Your accounts).
  const switchedIn = !isDemo(user) && hasReturn;
  const tplValue = { key: tpl.key, words: tpl.words, modules: tpl.modules };

  // The demo salon is shared, so each visitor's own browser remembers which
  // tips they've seen (null = this browser only): everyone gets the tour.
  return (
    <TemplateProvider value={tplValue}>
    <GuideProvider mode="pro" scope={user.id} initialSeen={isDemo(user) ? null : guidesSeen}>
    <div className={`db ${display.variable}`}>
      {/* The frame: grouped nav, drawer, phone tab bar, quick actions. */}
      <AppShell businessName={stylist.business_name} slug={stylist.slug} email={user.email} logout={logout} assistant={assistantOn} />

      <main className="db-main">
        <div className="db-page">
          {isDemo(user) && previewing ? (
            <div className="demo-banner" role="note">
              <p>
                <strong>Previewing as {tpl.label}</strong>: a sample account with example data, exactly what a new{" "}
                {tpl.words.pro} sees. Changes reset and nothing is sent.
              </p>
              <a href="/demo/exit-preview" className="button small">
                Exit preview
              </a>
            </div>
          ) : isDemo(user) ? (
            <div className="demo-banner" role="note">
              <p>
                <strong>You&apos;re exploring Maison Demo</strong>, a sample salon. Tap around and try anything: it
                resets every night, and nothing is sent to real people.
              </p>
              <a href="/demo/exit" className="button small">
                Start your free trial
              </a>
            </div>
          ) : switchedIn ? (
            <div className="demo-banner" role="note">
              <p>
                <strong>You&apos;re in your {tpl.label} account</strong> ({stylist.business_name}). Everything here
                is real and works like any pro&apos;s account.
              </p>
              <a href="/demo/exit-preview" className="button small">
                Back to my account
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
    </TemplateProvider>
  );
}
