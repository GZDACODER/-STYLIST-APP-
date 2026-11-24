// Settings > Public profile > Client photos: "My look" photos, and whether
// each client said yes to showing it on the public profile (step 61 SQL).
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SubmitButton from "@/components/SubmitButton";
import { setLookOnProfile } from "./lookActions";
import AskLook from "./AskLook";

const day = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function ClientLooks() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("bookings")
    .select("id, client_name, service_name, booking_date, look_photo_path, look_consent, look_consent_asked_at, look_on_profile, client_email")
    .not("look_photo_path", "is", null)
    .order("booking_date", { ascending: false })
    .limit(60);
  if (error) return null;
  const urlOf = {};
  if (rows?.length) {
    const { data } = await createAdminClient().storage.from("client-looks").createSignedUrls(rows.map((r) => r.look_photo_path), 3600);
    for (const d of data || []) if (d.signedUrl) urlOf[d.path] = d.signedUrl;
  }
  return (
    <section className="card">
      <h2>Client photos</h2>
      <p className="muted small-text">
        Photos you&apos;ve shared with clients in &quot;My look&quot;. A photo can only go on your profile if that client says
        yes. They can change their mind any time, and their name is never shown with it.
      </p>
      {!rows?.length ? (
        <p className="small-text">No client photos yet. Add one when you wrap up a visit.</p>
      ) : (
        <ul className="lk-list">
          {rows.map((r) => (
            <li key={r.id}>
              {urlOf[r.look_photo_path] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urlOf[r.look_photo_path]} alt="" loading="lazy" />
              )}
              <div>
                <p className="small-text">
                  <strong>{r.client_name}</strong> · {r.service_name} · {day(r.booking_date)}
                </p>
                <p className="small-text muted">
                  {r.look_consent === "yes"
                    ? r.look_on_profile
                      ? "They said yes · On your profile"
                      : "They said yes"
                    : r.look_consent === "no"
                      ? "They'd rather keep it private"
                      : r.look_consent_asked_at
                        ? "Asked, no answer yet"
                        : "Not asked yet"}
                </p>
                {r.look_consent === "yes" ? (
                  <form action={setLookOnProfile}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="on" value={r.look_on_profile ? "false" : "true"} />
                    <SubmitButton className={r.look_on_profile ? "button small secondary" : "button small"} pendingText="Saving...">
                      {r.look_on_profile ? "Hide from profile" : "Show on profile"}
                    </SubmitButton>
                  </form>
                ) : (
                  !r.look_consent && r.client_email && <AskLook id={r.id} again={Boolean(r.look_consent_asked_at)} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
