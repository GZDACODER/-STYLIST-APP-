"use client";

// Portfolio photos (Settings -> Your business): up to 12 photos of your work,
// shown on your booking page in this order. Add several at once; each can
// have a short caption, be moved earlier or later, or be removed.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_MAX_BYTES, shrinkPhoto } from "@/lib/shrinkPhoto";
import {
  addPortfolioPhoto,
  movePortfolioPhoto,
  removePortfolioPhoto,
  savePortfolioCaption,
  startPortfolioUpload,
} from "./portfolioActions";

const MAX = 12;

function PhotoTile({ photo, index, count, disabled, onAction }) {
  const [caption, setCaption] = useState(photo.caption || "");
  const [confirming, setConfirming] = useState(false);
  const changed = caption.trim() !== (photo.caption || "");

  return (
    <li className="pf-tile">
      <img src={photo.url} alt={photo.caption || `Portfolio photo ${index + 1}`} loading="lazy" decoding="async" />
      <form
        className="pf-caption"
        onSubmit={(e) => {
          e.preventDefault();
          onAction(() => savePortfolioCaption(photo.id, caption));
        }}
      >
        <input
          type="text"
          value={caption}
          maxLength={120}
          placeholder="Caption (optional)"
          aria-label={`Caption for photo ${index + 1}`}
          onChange={(e) => setCaption(e.target.value)}
          disabled={disabled}
        />
        {changed && (
          <button type="submit" className="button small" disabled={disabled}>
            Save
          </button>
        )}
      </form>
      {confirming ? (
        <div className="pf-actions">
          <span className="small-text">Remove this photo?</span>
          <button type="button" className="link-button" onClick={() => setConfirming(false)} disabled={disabled}>
            Keep
          </button>
          <button
            type="button"
            className="link-button quiet-link"
            onClick={() => onAction(() => removePortfolioPhoto(photo.id))}
            disabled={disabled}
          >
            Yes, remove
          </button>
        </div>
      ) : (
        <div className="pf-actions">
          <button
            type="button"
            className="pf-move"
            onClick={() => onAction(() => movePortfolioPhoto(photo.id, -1))}
            disabled={disabled || index === 0}
            aria-label={`Move photo ${index + 1} earlier`}
          >
            ←
          </button>
          <button
            type="button"
            className="pf-move"
            onClick={() => onAction(() => movePortfolioPhoto(photo.id, 1))}
            disabled={disabled || index === count - 1}
            aria-label={`Move photo ${index + 1} later`}
          >
            →
          </button>
          <button type="button" className="link-button quiet-link" onClick={() => setConfirming(true)} disabled={disabled}>
            Remove
          </button>
        </div>
      )}
    </li>
  );
}

export default function PortfolioForm({ photos, ready }) {
  const router = useRouter();
  const [message, setMessage] = useState(null);
  const [progress, setProgress] = useState(null);
  const [pending, startTransition] = useTransition();
  const busy = Boolean(progress) || pending;
  const room = MAX - photos.length;

  function act(run) {
    setMessage(null);
    startTransition(async () => {
      const result = await run();
      if (result?.error) setMessage({ error: result.error });
      router.refresh();
    });
  }

  async function upload(event) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length) return;
    setMessage(null);

    const take = files.slice(0, Math.max(0, room));
    const skipped = files.length - take.length;
    let added = 0;
    const problems = [];
    try {
      for (const [i, file] of take.entries()) {
        setProgress(`Uploading ${i + 1} of ${take.length}...`);
        if (file.type && !file.type.startsWith("image/")) {
          problems.push(`${file.name} isn't a photo.`);
          continue;
        }
        let blob;
        try {
          blob = await shrinkPhoto(file, 1600);
        } catch {
          problems.push(`${file.name} couldn't be read.`);
          continue;
        }
        if (blob.size > PHOTO_MAX_BYTES) {
          problems.push(`${file.name} is too big.`);
          continue;
        }
        const start = await startPortfolioUpload();
        if (start.error) {
          problems.push(start.error);
          break;
        }
        const { error: uploadError } = await createClient()
          .storage.from("portfolio")
          .uploadToSignedUrl(start.path, start.token, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (uploadError) {
          problems.push(`${file.name} didn't upload: ${uploadError.message}`);
          continue;
        }
        const saved = await addPortfolioPhoto(start.path);
        if (saved.error) {
          problems.push(saved.error);
          break;
        }
        added += 1;
      }
    } catch (error) {
      console.error("Portfolio upload failed", error);
      problems.push("The photos couldn't be uploaded. Please check your connection and try again.");
    } finally {
      setProgress(null);
    }

    if (skipped > 0) problems.push(`Only ${MAX} photos fit, so ${skipped} ${skipped === 1 ? "wasn't" : "weren't"} added.`);
    setMessage({
      success: added ? `${added} ${added === 1 ? "photo" : "photos"} added. They're on your booking page now.` : null,
      error: problems.length ? problems.join(" ") : null,
    });
    router.refresh();
  }

  return (
    <div className="pf">
      <span className="field-label">Portfolio</span>
      <p className="muted small-text">
        Up to {MAX} photos of your work, shown on your booking page in this order. Clients can tap one to see it
        bigger.
      </p>

      {!ready && (
        <p className="message warning">
          Run supabase/migrations/0031_portfolio.sql in Supabase to turn on portfolio photos.
        </p>
      )}

      {photos.length > 0 && (
        <ul className="pf-grid">
          {photos.map((photo, i) => (
            <PhotoTile
              key={`${photo.id}-${photo.caption}`}
              photo={photo}
              index={i}
              count={photos.length}
              disabled={busy}
              onAction={act}
            />
          ))}
        </ul>
      )}

      {ready && (
        <div className="row-links">
          {/* A label around the file input: iPhones and iPads always open the
              photo picker this way. Listing JPEG, PNG and WebP makes iPhones
              convert their HEIC photos. */}
          <label className={`button secondary small cover-photo-pick${busy || room <= 0 ? " is-busy" : ""}`}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={upload}
              disabled={busy || room <= 0}
              className="cover-photo-input"
            />
            {progress || (room <= 0 ? `${MAX} of ${MAX} photos` : photos.length ? "Add more photos" : "Add photos")}
          </label>
          {photos.length > 0 && room > 0 && (
            <span className="muted small-text">
              {photos.length} of {MAX}
            </span>
          )}
        </div>
      )}
      {message?.error && <p className="message error">{message.error}</p>}
      {message?.success && <p className="message success">{message.success}</p>}
    </div>
  );
}
