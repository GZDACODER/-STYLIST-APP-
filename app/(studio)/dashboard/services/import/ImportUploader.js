"use client";

// Pick up to 10 screenshots of your old service menu, then "Read my menu":
// each one is shrunk in the browser, uploaded straight to your private
// folder, and read on the server (actions.js). Then the review opens.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { shrinkPhoto } from "@/lib/shrinkPhoto";
import { readImport, startImport } from "./actions";

const APPS = "Booksy, GlossGenius, Square, Vagaro, StyleSeat, Instagram or a price list";

export default function ImportUploader({ max }) {
  const router = useRouter();
  const input = useRef(null);
  const [files, setFiles] = useState([]); // { file, url }
  const [step, setStep] = useState(null); // null | "upload" | "read"
  const [error, setError] = useState(null);

  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), [files]);

  const add = (list) => {
    setError(null);
    const picked = [...list].filter((f) => !f.type || f.type.startsWith("image/"));
    if (picked.length < list.length) setError("Only photos and screenshots can be added.");
    const next = [...files, ...picked.map((file) => ({ file, url: URL.createObjectURL(file) }))];
    if (next.length > max) setError(`You can add up to ${max} screenshots at a time.`);
    setFiles(next.slice(0, max));
  };
  const remove = (i) => setFiles(files.filter((_, j) => j !== i));

  async function go() {
    if (!files.length) return;
    setError(null);
    setStep("upload");
    try {
      const blobs = [];
      for (const f of files) {
        try {
          // Big enough to keep small menu text sharp.
          blobs.push(await shrinkPhoto(f.file, 2400));
        } catch {
          setError(`"${f.file.name}" couldn't be opened. Please use a JPEG or PNG screenshot.`);
          setStep(null);
          return;
        }
      }
      const start = await startImport(blobs.length);
      if (start.error) {
        setError(start.error);
        setStep(null);
        return;
      }
      const storage = createClient().storage.from("service-imports");
      for (let i = 0; i < blobs.length; i++) {
        const { error: upErr } = await storage.uploadToSignedUrl(start.uploads[i].path, start.uploads[i].token, blobs[i], { contentType: "image/jpeg" });
        if (upErr) {
          setError("A screenshot didn't upload. Please check your connection and try again.");
          setStep(null);
          return;
        }
      }
      setStep("read");
      const read = await readImport(start.id);
      router.push(`/dashboard/services/import?id=${start.id}`);
      if (read.error) router.refresh();
    } catch (e) {
      console.error("Services import failed", e);
      setError("Something went wrong. Please check your connection and try again.");
      setStep(null);
    }
  }

  if (step) {
    return (
      <section className="card si-reading" aria-live="polite">
        <span className="si-spinner" aria-hidden="true" />
        <h2>{step === "upload" ? "Uploading your screenshots…" : "Reading your menu…"}</h2>
        <p className="muted">{step === "upload" ? "Just a moment." : "This usually takes under a minute. Keep this page open."}</p>
      </section>
    );
  }

  return (
    <section className="card si-upload">
      <h2>Upload screenshots of your menu</h2>
      <p className="muted">
        Screenshots of your services from {APPS}. Up to {max}. Make sure names and prices are easy to read. Nothing is added
        until you check it.
      </p>
      <div
        className="si-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          add(e.dataTransfer.files);
        }}
      >
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        <button type="button" className="button secondary" onClick={() => input.current?.click()} disabled={files.length >= max}>
          {files.length ? "Add more screenshots" : "Choose screenshots"}
        </button>
        <p className="muted small-text">{files.length} of {max} added</p>
      </div>
      {files.length > 0 && (
        <ul className="si-thumbs">
          {files.map((f, i) => (
            <li key={f.url}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={`Screenshot ${i + 1}`} />
              <button type="button" className="si-thumb-x" aria-label={`Remove screenshot ${i + 1}`} onClick={() => remove(i)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="message error">{error}</p>}
      <button type="button" className="button si-go" disabled={!files.length} onClick={go}>
        Read my menu
      </button>
    </section>
  );
}
