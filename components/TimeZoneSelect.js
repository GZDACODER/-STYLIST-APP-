"use client";

import { useEffect, useState } from "react";
import { US_TIME_ZONES, timeZoneLabel } from "@/lib/availability";

// US time zones by name first, then every other time zone in the world.
export default function TimeZoneSelect({ name, defaultValue }) {
  const [zone, setZone] = useState(defaultValue);
  // Filled in once the page is open in the browser.
  const [deviceZone, setDeviceZone] = useState(null);
  const [otherZones, setOtherZones] = useState([]);

  useEffect(() => {
    setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (Intl.supportedValuesOf) setOtherZones(Intl.supportedValuesOf("timeZone"));
  }, []);

  const usValues = US_TIME_ZONES.map((z) => z.value);
  const others = otherZones.filter((z) => !usValues.includes(z));
  // Make sure the saved zone is always in the list.
  if (!usValues.includes(zone) && !others.includes(zone)) others.unshift(zone);

  return (
    <>
      <select name={name} value={zone} onChange={(e) => setZone(e.target.value)}>
        <optgroup label="United States">
          {US_TIME_ZONES.map((z) => (
            <option key={z.value} value={z.value}>
              {z.label} time
            </option>
          ))}
        </optgroup>
        {others.length > 0 && (
          <optgroup label="Other time zones">
            {others.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {deviceZone && deviceZone !== zone && (
        <p className="message info">
          Your device is set to {timeZoneLabel(deviceZone)} time.{" "}
          <button type="button" className="link-button" onClick={() => setZone(deviceZone)}>
            Use {timeZoneLabel(deviceZone)} time
          </button>
        </p>
      )}
    </>
  );
}
