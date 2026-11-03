"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { removeCoverPhoto, saveCoverPhoto } from "./actions";

// Photos are shrunk in the browser before uploading, so a big phone photo
// uploads quickly and the booking page loads fast.
const MAX_SIDE = 2000;
const MAX_BYTES = 5 * 1024 * 1024;

async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/jpeg", 0.85)
  );
}

// The cover photo on the booking page's black panel.
export default function CoverPhotoForm({ userId, coverUrl }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const working = busy || pending;

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(null);

    if (!file.type.startsWith("image/")) {
      setMessage({ error: "Please choose a photo." });
      return;
    }

    setBusy(true);
    try {
      let blob;
      try {
        blob = await shrink(file);
      } catch {
        setMessage({ error: "That photo couldn't be read. Please choose a JPEG, PNG or WebP photo." });
        return;
      }
      if (blob.size > MAX_BYTES) {
        setMessage({ error: "That photo is too big. Please choose a smaller one." });
        return;
      }

      const supabase = createClient();
      const path = `${userId}/cover-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("covers")
        .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
      if (uploadError) {
        setMessage({
          error: /bucket not found/i.test(uploadError.message)
            ? "Run supabase/migrations/0014_cover_and_links.sql in Supabase first, then try again."
            : `The photo didn't upload: ${uploadError.message}`,
        });
        return;
      }

      const { data } = supabase.storage.from("covers").getPublicUrl(path);
      const result = await saveCoverPhoto(data.publicUrl);
      if (result.error) {
        // Not saved, so don't leave the file behind.
        await supabase.storage.from("covers").remove([path]);
      }
      setMessage(result);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    setMessage(null);
    startTransition(async () => {
      setMessage(await removeCoverPhoto());
      router.refresh();
    });
  }

  return (
    <div className="cover-photo">
      <span className="field-label">Cover photo</span>
      {coverUrl ? (
        <img className="cover-photo-preview" src={coverUrl} alt="Your cover photo" />
      ) : (
        <p className="muted small-text">
          Shown full-size in the black panel on your booking page, with your name over it. Without
          one, the panel shows your name on black.
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={upload}
        hidden
      />
      <div className="row-links">
        <button
          type="button"
          className="button secondary small"
          onClick={() => inputRef.current?.click()}
          disabled={working}
        >
          {busy ? "Uploading..." : coverUrl ? "Change photo" : "Upload photo"}
        </button>
        {coverUrl && (
          <button type="button" className="link-button" onClick={remove} disabled={working}>
            {pending ? "Removing..." : "Remove photo"}
          </button>
        )}
      </div>
      {message?.error && <p className="message error">{message.error}</p>}
      {message?.success && <p className="message success">{message.success}</p>}
    </div>
  );
}
