"use client";

// Add up to `max` photos: each is shrunk on the phone (longest side 1600px,
// JPEG) before upload, so it's quick on 4G. Calls onChange(paths).
import { useState } from "react";

async function shrink(file) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.82));
  return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
}

export default function PhotoPicker({ slug, max = 3, label = "Add photos", note = "", onChange }) {
  const [items, setItems] = useState([]); // { path, url }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const add = async (files) => {
    setError(null);
    setBusy(true);
    const next = [...items];
    for (const f of [...files].slice(0, max - next.length)) {
      try {
        const small = await shrink(f);
        const body = new FormData();
        body.append("photo", small);
        body.append("slug", slug);
        const res = await fetch("/api/booking-photo", { method: "POST", body });
        const json = await res.json();
        if (!res.ok || !json.path) throw new Error(json.error || "Couldn't add that photo.");
        next.push({ path: json.path, url: URL.createObjectURL(small) });
      } catch (e) {
        setError(e.message);
      }
    }
    setItems(next);
    onChange?.(next.map((i) => i.path));
    setBusy(false);
  };
  const remove = (i) => {
    const next = items.filter((_, j) => j !== i);
    setItems(next);
    onChange?.(next.map((x) => x.path));
  };

  return (
    <div className="photos-pick">
      <p className="photos-pick-label">{label}</p>
      {note && <p className="muted small-text">{note}</p>}
      <div className="photos-pick-row">
        {items.map((it, i) => (
          <span key={it.path} className="photos-pick-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.url} alt={`Photo ${i + 1}`} />
            <button type="button" onClick={() => remove(i)} aria-label={`Remove photo ${i + 1}`}>
              ×
            </button>
          </span>
        ))}
        {items.length < max && (
          <label className={busy ? "photos-pick-add busy" : "photos-pick-add"}>
            <input type="file" accept="image/*" multiple onChange={(e) => add(e.target.files)} disabled={busy} />
            {busy ? "Adding..." : "+ Photo"}
          </label>
        )}
      </div>
      {error && <p className="message error small-text">{error}</p>}
    </div>
  );
}
