"use client";

import { useActionState, useEffect, useState } from "react";
import { saveBookingLink } from "./actions";
import { timeZoneLabel } from "@/lib/availability";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function BookingLinkForm({ origin, slug, timezone }) {
  const [state, formAction] = useActionState(saveBookingLink, null);
  const [copied, setCopied] = useState(false);
  const [zone, setZone] = useState(timezone);
  // Filled in once the page is open in the browser.
  const [deviceZone, setDeviceZone] = useState(null);
  const [allZones, setAllZones] = useState([timezone]);

  useEffect(() => {
    setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (Intl.supportedValuesOf) setAllZones(Intl.supportedValuesOf("timeZone"));
  }, []);

  const link = `${origin}/book/${slug}`;
  const zones = allZones.includes(zone) ? allZones : [zone, ...allZones];

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your booking link:", link);
    }
  }

  return (
    <>
      <p className="booking-link">{link}</p>
      <div className="row">
        <button type="button" className="button" onClick={copyLink}>
          {copied ? "Copied!" : "Copy link"}
        </button>
        <a className="button secondary" href={link} target="_blank" rel="noreferrer">
          Open page
        </a>
      </div>

      <details className="link-settings">
        <summary>Change link or time zone</summary>
        <form action={formAction}>
          <label>
            Your link
            <div className="prefixed">
              <span>/book/</span>
              <input
                name="slug"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={40}
                defaultValue={slug}
                required
              />
            </div>
          </label>
          <label>
            Time zone (your openings use this)
            <select name="timezone" value={zone} onChange={(e) => setZone(e.target.value)}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          {deviceZone && deviceZone !== zone && (
            <p className="message info">
              Your device is set to {timeZoneLabel(deviceZone)} time.{" "}
              <button type="button" className="link-button" onClick={() => setZone(deviceZone)}>
                Use {timeZoneLabel(deviceZone)}
              </button>
            </p>
          )}
          <SubmitButton pendingText="Saving...">Save</SubmitButton>
          <FormMessage state={state} />
        </form>
      </details>
    </>
  );
}
