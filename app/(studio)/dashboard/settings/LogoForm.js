"use client";

// Settings → Booking page → Photos & links: the logo at the top of the
// booking page (PNG keeps a see-through background) and the brand colour
// for its buttons and highlights.
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { shrinkPhoto } from "@/lib/shrinkPhoto";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { removeLogo, saveAccentColor, saveLogo, startLogoUpload } from "./actions";

const KEEP_AS_IS = 1024 * 1024; // smaller files upload untouched (keeps transparency)
const TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export default function LogoForm({ logoUrl, accent }) {
  const router = useRouter();
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [colorState, colorAction] = useActionState(saveAccentColor, null);
  const [color, setColor] = useState(accent || "#a8874d");

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(null);
    if (!TYPES[file.type]) {
      setMessage({ error: "Please choose a PNG, JPEG or WebP image." });
      return;
    }
    setBusy(true);
    try {
      let blob = file;
      let ext = TYPES[file.type];
      if (file.size > KEEP_AS_IS) {
        blob = await shrinkPhoto(file, 800);
        ext = "jpg";
      }
      const start = await startLogoUpload(ext);
      if (start.error) return setMessage(start);
      const { error } = await createClient()
        .storage.from("covers")
        .uploadToSignedUrl(start.path, start.token, blob, {
          contentType: ext === "jpg" ? "image/jpeg" : `image/${ext}`,
          cacheControl: "31536000",
        });
      if (error) return setMessage({ error: `The logo didn't upload: ${error.message}` });
      const result = await saveLogo(start.path);
      setMessage(result);
      if (result.success) router.refresh();
    } catch {
      setMessage({ error: "The logo couldn't be uploaded. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cover-photo">
      <span className="field-label">Logo</span>
      {logoUrl ? (
        <img className="logo-preview" src={logoUrl} alt="Your logo" />
      ) : (
        <p className="muted small-text">Shown at the top of your booking page. A PNG with a see-through background looks best.</p>
      )}
      <div className="row-links">
        <label className={`button secondary small cover-photo-pick${busy ? " is-busy" : ""}`}>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} disabled={busy || pending} className="cover-photo-input" />
          {busy ? "Uploading..." : logoUrl ? "Change logo" : "Upload logo"}
        </label>
        {logoUrl && (
          <button
            type="button"
            className="link-button"
            disabled={busy || pending}
            onClick={() =>
              startTransition(async () => {
                setMessage(await removeLogo());
                router.refresh();
              })
            }
          >
            {pending ? "Removing..." : "Remove logo"}
          </button>
        )}
      </div>
      {message?.error && <p className="message error">{message.error}</p>}
      {message?.success && <p className="message success">{message.success}</p>}

      <form action={colorAction} className="accent-form">
        <label className="accent-pick">
          <span className="field-label">Brand colour</span>
          <span className="row">
            <input type="color" name="accent_color" value={color} onChange={(e) => setColor(e.target.value)} />
            <code>{color}</code>
          </span>
        </label>
        <p className="muted small-text">Used for buttons and highlights on your booking page.</p>
        <div className="row">
          <SubmitButton className="button secondary small" pendingText="Saving...">
            Save colour
          </SubmitButton>
          {accent && (
            <button type="submit" name="reset" value="1" className="link-button small-text">
              Use the standard gold
            </button>
          )}
        </div>
        <FormMessage state={colorState} />
      </form>
    </div>
  );
}
