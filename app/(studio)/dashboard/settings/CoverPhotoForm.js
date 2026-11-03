"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { removeCoverPhoto, saveCoverPhoto, startCoverUpload } from "./actions";

// Photos are shrunk in the browser before uploading, so a big phone photo
// uploads quickly and the booking page loads fast.
const MAX_SIDE = 2000;
const MAX_BYTES = 5 * 1024 * 1024;

// Opens the photo the way the browser shows images, which works for every
// format the device can display (including iPhone photos) and keeps it the
// right way up.
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, done: () => URL.revokeObjectURL(url) });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The photo couldn't be opened"));
    };
    img.src = url;
  });
}

async function shrink(file) {
  const { img, done } = await loadImage(file);
  try {
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) throw new Error("The photo has no size");
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("The photo couldn't be converted"))),
        "image/jpeg",
        0.85
      )
    );
  } finally {
    done();
  }
}

// The cover photo on the booking page's black panel.
export default function CoverPhotoForm({ userId, coverUrl }) {
  const router = useRouter();
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const working = busy || pending;

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(null);

    if (file.type && !file.type.startsWith("image/")) {
      setMessage({ error: "Please choose a photo." });
      return;
    }

    setBusy(true);
    try {
      let blob;
      try {
        blob = await shrink(file);
      } catch (error) {
        console.error("Cover photo: couldn't read the photo", error);
        setMessage({ error: "That photo couldn't be read. Please choose a JPEG, PNG or WebP photo." });
        return;
      }
      if (blob.size > MAX_BYTES) {
        setMessage({ error: "That photo is too big. Please choose a smaller one." });
        return;
      }

      // 1. A one-time upload link from the server (it checks the login).
      const start = await startCoverUpload();
      if (start.error) {
        setMessage(start);
        return;
      }

      // 2. Send the photo straight to Supabase Storage with that link.
      const { error: uploadError } = await createClient()
        .storage.from("covers")
        .uploadToSignedUrl(start.path, start.token, blob, {
          contentType: "image/jpeg",
          cacheControl: "31536000",
        });
      if (uploadError) {
        console.error("Cover photo: upload failed", uploadError);
        setMessage({ error: `The photo didn't upload: ${uploadError.message}` });
        return;
      }

      // 3. Save it on the profile (this also deletes the old photo).
      const result = await saveCoverPhoto(start.path);
      setMessage(result);
      if (result.success) router.refresh();
    } catch (error) {
      console.error("Cover photo: something went wrong", error);
      setMessage({ error: "The photo couldn't be uploaded. Please check your connection and try again." });
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
      <div className="row-links">
        {/* A label around the file input (not a hidden input clicked by code):
            iPhones and iPads always open the photo picker this way. Listing
            only JPEG, PNG and WebP makes iPhones convert their HEIC photos. */}
        <label className={`button secondary small cover-photo-pick${working ? " is-busy" : ""}`}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={upload}
            disabled={working}
            className="cover-photo-input"
          />
          {busy ? "Uploading..." : coverUrl ? "Change photo" : "Upload photo"}
        </label>
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
