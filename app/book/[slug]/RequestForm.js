"use client";

// For services the pro approves first (services.request_first): instead of
// picking a time, the client sends their idea, placement, size, reference
// photos and when they're free. The pro approves (and emails a booking
// link) or declines.
import { useState, useTransition } from "react";
import PhotoPicker from "@/components/PhotoPicker";
import { sendRequest } from "../actions";

export default function RequestForm({ slug, service, businessName, photosOn = true }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", idea: "", placement: "", size: "", availability: "" });
  const [photos, setPhotos] = useState([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (done) {
    return (
      <p className="message success" role="status">
        Request sent! {businessName} will look at it and email you. If they approve it, you&apos;ll get a link to book
        your time.
      </p>
    );
  }
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await sendRequest({ slug, serviceId: service.id, ...f, photos });
          if (r.error) setError(r.error);
          else setDone(true);
        });
      }}
    >
      <p className="muted small-text">
        {businessName} looks at each {service.name.toLowerCase()} request before you book. Tell them about it below.
      </p>
      <label>
        Describe your idea
        <textarea rows={4} maxLength={3000} value={f.idea} onChange={set("idea")} required />
      </label>
      <label>
        Placement (where on the body)
        <input type="text" maxLength={200} value={f.placement} onChange={set("placement")} required />
      </label>
      <label>
        Approximate size
        <input type="text" maxLength={200} placeholder="e.g. 4 inches" value={f.size} onChange={set("size")} />
      </label>
      {photosOn && (
        <PhotoPicker slug={slug} max={3} label="Reference photos (up to 3)" note="Designs, placement photos or inspiration." onChange={setPhotos} />
      )}
      <label>
        When are you usually free?
        <input type="text" maxLength={500} placeholder="e.g. weekday evenings, Saturdays" value={f.availability} onChange={set("availability")} />
      </label>
      <label>
        Your name
        <input type="text" autoComplete="name" maxLength={100} value={f.name} onChange={set("name")} required />
      </label>
      <label>
        Email
        <input type="email" autoComplete="email" maxLength={200} value={f.email} onChange={set("email")} required />
      </label>
      <label>
        Mobile number (optional)
        <input type="tel" autoComplete="tel" maxLength={40} value={f.phone} onChange={set("phone")} />
      </label>
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Sending..." : "Send request"}
      </button>
      {error && <p className="message error">{error}</p>}
    </form>
  );
}
