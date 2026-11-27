import { getUser } from "@/lib/supabase/user";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Cormorant_Garamond } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import PlanBanner from "./PlanBanner";
import CreateStylistForm from "./CreateStylistForm";
import { getMyPlan } from "@/lib/plan";
import { isAdmin } from "@/lib/admin";
import AppShell from "./shell/AppShell";
import AssistantWidget from "./assistant/AssistantWidget";
import { PLANS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";
import GuideProvider from "@/components/guide/GuideProvider";
import { isDemo } from "@/lib/demo";
import { PRO_TERMS_VERSION } from "@/lib/agreements";
import { TemplateProvider } from "@/components/TemplateContext";
import { getMyTemplate } from "@/lib/templates/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HELP_COOKIE, helpState } from "@/lib/helpMode";
import { endHelp } from "./settings/helpActions";
import { invitesForEmail } from "@/lib/shopsServer";
import { JoinShopForm } from "./shop/ShopForms";
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
  const user = await getUser();
  if (!user) redirect("/login");

  // One read of the business row (first name too, for the Assistant).
  const STYLIST_COLS = "business_name, slug, first_name, timezone";
  const readStylist = async () => {
    const r = await supabase.from("stylists").select(STYLIST_COLS).eq("id", user.id).maybeSingle();
    // A database from before the first-name column: read without it.
    return r.error ? (await supabase.from("stylists").select("business_name, slug").eq("id", user.id).maybeSingle()).data : r.data;
  };
  let stylist = await readStylist();

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
    stylist = await readStylist();
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

  // Everything else the frame needs, at the same time (they don't depend on
  // each other): the plan, which first-visit tips they've seen (null before
  // the step 44 SQL: then only this phone remembers), the Clientele
  // agreement check (step 54 SQL; demo accounts are exempt), the
  // business-type template, and the cookies.
  const [plan, guidesSeen, signed, tpl, cookieStore] = await Promise.all([
    getMyPlan(supabase, user.id),
    Promise.resolve(supabase.from("onboarding_guides_seen").select("guide_key")).then(({ data, error }) =>
      error ? null : (data || []).map((r) => r.guide_key)
    ),
    isDemo(user)
      ? { data: [true], error: null }
      : supabase
          .from("pro_agreements")
          .select("id")
          .eq("stylist_id", user.id)
          .eq("kind", "pro_terms")
          .gte("version", PRO_TERMS_VERSION)
          .limit(1),
    getMyTemplate(),
    cookies(),
  ]);
  // Not signed (or an older version): sign before using the dashboard.
  if (!signed.error && !signed.data?.length) redirect("/agreement");

  // The pop-up Assistant: its button shows for every pro once it's switched
  // on for the app (ANTHROPIC_API_KEY in Vercel). Without it on their plan
  // (the add-on, or the free trial) it opens an "Add the Assistant" card
  // instead of the chat.
  const assistantOn = Boolean(process.env.ANTHROPIC_API_KEY);
  const assistantLocked = !plan?.has.assistant;
  const firstName = assistantOn ? stylist.first_name || "" : "";

  // The owner previewing a business type from the Control Room.
  // Help mode (0078 SQL). Support inside this account: the session must still
  // be open and for this pro, or support goes straight back to their own.
  const helpId = cookieStore.get(HELP_COOKIE)?.value;
  let helping = null;
  if (helpId) {
    const { data: hs } = await createAdminClient()
      .from("help_sessions")
      .select("id, stylist_id, expires_at, ended_at")
      .eq("id", helpId)
      .maybeSingle();
    if (!hs || hs.stylist_id !== user.id || helpState(hs) !== "open") redirect("/dashboard/admin/help/exit?reason=ended");
    helping = hs;
  }
  // The pro's own view: help mode is on for their account.
  let helpOpen = null;
  if (!helping) {
    const { data: mine } = await supabase
      .from("help_sessions")
      .select("expires_at")
      .is("ended_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1);
    helpOpen = mine?.[0] || null;
  }
  const helpTime = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: stylist.timezone || "America/Chicago" });

  const hasReturn = Boolean(cookieStore.get("cl_admin_return")?.value);
  const previewing = isDemo(user) && hasReturn;
  // The owner inside one of their own extra accounts (Control Room > Your accounts).
  const switchedIn = !isDemo(user) && hasReturn;
  const tplValue = { key: tpl.key, words: tpl.words, modules: tpl.modules };
  // A shop invited this email to take a chair (0081 SQL): offer Join.
  const shopInvite = !isDemo(user) && !helping ? (await invitesForEmail(user.email).catch(() => []))[0] : null;

  // The demo salon is shared, so each visitor's own browser remembers which
  // tips they've seen (null = this browser only): everyone gets the tour.
  return (
    <TemplateProvider value={tplValue}>
    <GuideProvider mode="pro" scope={user.id} initialSeen={isDemo(user) ? null : guidesSeen}>
    <div className={`db ${display.variable}`}>
      {/* The frame: grouped nav, drawer, phone tab bar, quick actions. */}
      <AppShell businessName={stylist.business_name} slug={stylist.slug} email={user.email} logout={logout} assistant={assistantOn} admin={isAdmin(user)} />

      <main className="db-main">
        <div className="db-page">
          {helping ? (
            <div className="demo-banner help-banner" role="note">
              <p>
                <strong>Help mode: you&apos;re in {stylist.business_name}&apos;s account.</strong> Everything you change is
                real, logged and emailed to them. Billing, payouts and exports are locked. Ends at {helpTime(helping.expires_at)}.
              </p>
              <a href="/dashboard/admin/help/exit" className="button small">
                Finish and go back
              </a>
            </div>
          ) : helpOpen ? (
            <div className="demo-banner help-banner" role="note">
              <p>
                <strong>Help mode is on until {helpTime(helpOpen.expires_at)}.</strong> Clientele support can open your
                dashboard to help. Every change is listed in <a href="/dashboard/settings/support">Settings → Support</a>.
              </p>
              <form action={endHelp}>
                <button type="submit" className="button small secondary">
                  End help
                </button>
              </form>
            </div>
          ) : isDemo(user) && previewing ? (
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
          {shopInvite && (
            <div className="demo-banner" role="note">
              <p>
                <strong>{shopInvite.shop?.name || "A shop"} invited you to take a chair.</strong> The shop pays for your plan;
                your booking page, clients and payouts stay yours.
              </p>
              <JoinShopForm token={shopInvite.invite_token} label="Join" />
            </div>
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
