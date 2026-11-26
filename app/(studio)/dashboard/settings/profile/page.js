// Settings > Public profile: the pro's page at clientelesuite.com/p/<handle>
// (step 57 SQL). Off until they switch it on; they can preview it first.
import { getUser } from "@/lib/supabase/user";
import { redirect } from "next/navigation";
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanHandle, DEFAULT_SHOW, handleProblem } from "@/lib/profileShared";
import { publicSiteUrl } from "@/lib/siteUrl";
import ProfileForm from "../ProfileForm";
import { sample } from "@/lib/examples";
import ClientLooks from "../ClientLooks";
import { getMyTemplate } from "@/lib/templates/server";

export const metadata = { title: `Public profile · ${BRAND_NAME}` };

// A free handle to suggest: from the business name, then with a number.
async function suggestHandle(name, id) {
  const base = cleanHandle(name) || "my-studio";
  const admin = createAdminClient();
  for (const h of [base, `${base}-${String(id).slice(0, 4)}`, `${base}-${String(id).slice(0, 8)}`]) {
    if (handleProblem(h)) continue;
    const { data } = await admin.from("stylists").select("id").eq("handle", h).neq("id", id).maybeSingle();
    if (!data) return h;
  }
  return "";
}

export default async function Page() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");
  const { data: s, error } = await supabase
    .from("stylists")
    .select("business_name, first_name, handle, profile_on, in_search, owner_name, city, bio, specialties, years_in_business, tiktok, website, profile_show")
    .eq("id", user.id)
    .maybeSingle();

  const myLookOn = (await getMyTemplate()).modules.myLook !== false;
  const { count: followers } = await supabase
    .from("profile_followers")
    .select("id", { count: "exact", head: true })
    .not("verified_at", "is", null)
    .is("unsubscribed_at", null);

  return (
    <SettingsShell active="profile" subtitle="A page clients can find, share and book from.">
      {error || !s ? (
        <p className="message error">Public profiles aren&apos;t set up yet (step 57 SQL).</p>
      ) : (
        <>
        <p className="message info">
          <strong>{followers || 0}</strong> {followers === 1 ? "person is" : "people are"} following you for opening alerts.{" "}
          <a href="/dashboard/followers">See who</a> · <a href="/dashboard/reviews">Reviews</a>
        </p>
        <ProfileForm
          site={publicSiteUrl("https://www.clientelesuite.com")}
          hints={sample(await getMyTemplate())}
          initial={{
            handle: s.handle || (await suggestHandle(s.business_name, user.id)),
            savedHandle: s.handle || null,
            profile_on: s.profile_on,
            in_search: s.in_search,
            owner_name: s.owner_name || s.first_name || "",
            city: s.city || "",
            bio: s.bio || "",
            specialties: s.specialties || "",
            years: s.years_in_business,
            tiktok: s.tiktok || "",
            website: s.website || "",
            show: { ...DEFAULT_SHOW, ...(s.profile_show || {}) },
          }}
        />
        {myLookOn && <ClientLooks />}
        </>
      )}
    </SettingsShell>
  );
}
