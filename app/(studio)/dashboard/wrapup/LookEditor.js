"use client";

// Wrap up: "My look" for one visit: a photo of the style and notes to share
// with the client (they see them on their client home). Private visit notes
// stay private; only what's here is shared.
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_MAX_BYTES, shrinkPhoto } from "@/lib/shrinkPhoto";
import { saveLook, startLookUpload } from "../clientFeatureActions";

export default function LookEditor({ bookingId, photoUrl, note, example = false }) {
  const [text, setText] = useState(note || "");
  const [preview, setPreview] = useState(photoUrl || null);
  const [message, setMessage] = useState(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || example) return;
    setBusy(true);
    setMessage(null);
    try {
      const blob = await shrinkPhoto(file, 1600);
      if (blob.size > PHOTO_MAX_BYTES) throw new Error("That photo is too big.");
      const start = await startLookUpload(bookingId);
      if (start.error) throw new Error(start.error);
      const { error } = await createClient()
        .storage.from("client-looks")
        .uploadToSignedUrl(start.path, start.token, blob, { contentType: "image/jpeg" });
      if (error) throw new Error(`The photo didn't upload: ${error.message}`);
      const saved = await saveLook({ bookingId, photoPath: start.path, note: text });
      if (saved.error) throw new Error(saved.error);
      setPreview(URL.createObjectURL(blob));
      setMessage({ ok: "Photo shared with the client." });
    } catch (error) {
      setMessage({ error: error.message || "The photo didn't upload." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="look-editor">
      <summary>Share their look {preview || note ? "· shared" : ""}</summary>
      <p className="muted small-text">
        A photo and notes for the client (like a colour formula). They see these when they sign in. Your private notes
        aren&apos;t shared.
      </p>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Their look" className="look-thumb" />
      )}
      <label className="button secondary small look-pick">
        {busy ? "Uploading..." : preview ? "Replace photo" : "Add a photo"}
        <input type="file" accept="image/*" onChange={pick} hidden disabled={busy || example} />
      </label>
      {preview && !example && (
        <button
          type="button"
          className="link-button small-text"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await saveLook({ bookingId, note: text, removePhoto: true });
              if (res.error) setMessage({ error: res.error });
              else {
                setPreview(null);
                setMessage({ ok: "Photo removed." });
              }
            })
          }
        >
          Remove photo
        </button>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (example) return;
          startTransition(async () => {
            const res = await saveLook({ bookingId, note: text });
            setMessage(res.error ? { error: res.error } : { ok: res.success });
          });
        }}
      >
        <label>
          Notes for the client
          <textarea rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Formula: 6N + 20 vol, 35 min" />
        </label>
        <button type="submit" className="button small" disabled={pending || example}>
          {pending ? "Saving..." : "Share notes"}
        </button>
      </form>
      {message?.ok && <p className="message success small-text">{message.ok}</p>}
      {message?.error && <p className="message error small-text">{message.error}</p>}
    </details>
  );
}
