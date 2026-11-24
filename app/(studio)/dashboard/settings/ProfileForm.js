"use client";

import { useActionState, useState } from "react";
import { saveProfile } from "./profileActions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { PROFILE_SHOW_KEYS, cleanHandle } from "@/lib/profileShared";

export default function ProfileForm({ initial, site, hints = {} }) {
  const [state, formAction] = useActionState(saveProfile, null);
  const v = state?.values || null;
  const pick = (k, fallback) => (v ? v[k] ?? "" : fallback ?? "");
  const [handle, setHandle] = useState(pick("handle", initial.handle));
  const [on, setOn] = useState(v ? v.profile_on === "on" : initial.profile_on);
  const saved = state?.handle || initial.savedHandle;

  return (
    <form action={formAction} className="stack pf-form">
      <section className="card">
        <h2>Your profile</h2>
        <label className="check-row">
          <input type="checkbox" name="profile_on" checked={on} onChange={(e) => setOn(e.target.checked)} />
          <span>
            <strong>Profile is {on ? "on" : "off"}</strong>
            <span className="muted small-text"> · When it&apos;s on, anyone with the link can see it.</span>
          </span>
        </label>
        <label>
          Your profile link
          <span className="pf-handle">
            <span className="muted">{site.replace(/^https?:\/\//, "")}/p/</span>
            <input
              name="handle"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={30}
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
              onBlur={() => setHandle(cleanHandle(handle))}
              required
            />
          </span>
        </label>
        <p className="muted small-text">Letters, numbers and dashes. Put it in your Instagram or TikTok bio. Your booking link stays the same.</p>
        <label className="check-row">
          <input type="checkbox" name="in_search" defaultChecked={v ? v.in_search === "on" : initial.in_search} disabled={!on} />
          <span>
            <strong>Show me in search</strong>
            <span className="muted small-text"> · Clients can find you by name on Clientele. Needs your profile on.</span>
          </span>
        </label>
        {saved && (
          <p>
            <a className="button secondary small" href={`/p/${saved}`} target="_blank" rel="noreferrer">
              {initial.profile_on || state?.success?.includes("live") ? "View my profile" : "Preview my profile"}
            </a>
          </p>
        )}
      </section>

      <section className="card">
        <h2>About you</h2>
        <label>
          Your name (owner)
          <input name="owner_name" type="text" maxLength={80} defaultValue={pick("owner_name", initial.owner_name)} placeholder={hints.owner} />
        </label>
        <label>
          City or area
          <input name="city" type="text" maxLength={80} defaultValue={pick("city", initial.city)} placeholder="e.g. Pilsen, Chicago" />
        </label>
        <p className="muted small-text">Just the area. Your street address is never shown here.</p>
        <label>
          Bio
          <textarea name="bio" rows={5} maxLength={1200} defaultValue={pick("bio", initial.bio)} placeholder={hints.bio} />
        </label>
        <label>
          Specialties
          <input name="specialties" type="text" maxLength={300} defaultValue={pick("specialties", initial.specialties)} placeholder={hints.specialties} />
        </label>
        <p className="muted small-text">Separate them with commas.</p>
        <label>
          Years in business
          <input name="years" type="number" min={0} max={80} inputMode="numeric" defaultValue={pick("years", initial.years ?? "")} />
        </label>
        <label>
          TikTok (optional)
          <input name="tiktok" type="text" autoCapitalize="none" maxLength={80} defaultValue={pick("tiktok", initial.tiktok)} placeholder="@yourname" />
        </label>
        <label>
          Website (optional)
          <input name="website" type="text" autoCapitalize="none" inputMode="url" maxLength={200} defaultValue={pick("website", initial.website)} placeholder="yourwebsite.com" />
        </label>
        <p className="muted small-text">
          Your photo, Instagram, services, policies and hours come from the rest of Settings, so there&apos;s nothing to type twice.
        </p>
      </section>

      <section className="card">
        <h2>What shows</h2>
        {PROFILE_SHOW_KEYS.map(([k, label]) => (
          <label key={k} className="check-row">
            <input type="checkbox" name={`show_${k}`} defaultChecked={v ? v[`show_${k}`] === "on" : initial.show[k]} />
            <span>{label}</span>
          </label>
        ))}
        <p className="muted small-text">
          Your star rating counts every rating. Written reviews only show once you approve them in{" "}
          <a href="/dashboard/reviews">Reviews</a>.
        </p>
      </section>

      <SubmitButton pendingText="Saving...">Save profile</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
