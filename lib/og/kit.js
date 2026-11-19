// The "Book now" kit images for a pro's booking link (Share kit in the
// dashboard). Server code only.
//   - qrPng: the QR code on its own, for anything.
//   - storyImage: 1080 x 1920 Instagram/TikTok story, black and gold, with
//     the QR code and the link.
//   - cardImage: a 1500 x 2100 (5 x 7 in) printable card for the station or
//     mirror: "Scan to book" and the QR code.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";

const GOLD = "#c8a96a";
const GOLD_LIGHT = "#e6cd7e";
const PAPER = "#f5f1ea";
const INK = "#0e0d0b";

let fontsPromise;
function loadFonts() {
  fontsPromise ??= Promise.all([
    readFile(join(process.cwd(), "lib/og/fonts/GreatVibes-Regular.woff")),
    readFile(join(process.cwd(), "lib/og/fonts/Inter-Medium.woff")),
  ]).then(([script, sans]) => [
    { name: "Great Vibes", data: script, weight: 400, style: "normal" },
    { name: "Inter", data: sans, weight: 500, style: "normal" },
  ]);
  return fontsPromise;
}

const QR_OPTIONS = { errorCorrectionLevel: "M", margin: 2, color: { dark: "#0e0d0bff", light: "#ffffffff" } };

export async function qrPng(link, size = 1024) {
  return QRCode.toBuffer(link, { ...QR_OPTIONS, type: "png", width: size });
}

const qrDataUrl = (link, size) => QRCode.toDataURL(link, { ...QR_OPTIONS, width: size });

// "www.clientelesuite.com/book/royal-suite" (no https://), for printing.
const shortLink = (link) => String(link).replace(/^https?:\/\//, "");

function nameSize(name, big) {
  const n = String(name || "").length;
  if (n <= 12) return big;
  if (n <= 20) return Math.round(big * 0.78);
  if (n <= 30) return Math.round(big * 0.6);
  return Math.round(big * 0.46);
}
const scriptName = (name) => String(name || "").trim().split(/\s+/).join(" ");

export async function storyImage({ name, link, photoUrl = null }) {
  const [fonts, qr] = await Promise.all([loadFonts(), qrDataUrl(link, 560)]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: INK, fontFamily: "Inter" }}>
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" width={1080} height={1920} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {photoUrl && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.92) 75%)",
            }}
          />
        )}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            padding: "0 80px",
          }}
        >
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 12, color: GOLD, textTransform: "uppercase", paddingLeft: 12 }}>
            Now booking
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Great Vibes",
              fontSize: nameSize(name, 170),
              lineHeight: 1.1,
              color: photoUrl ? PAPER : GOLD_LIGHT,
              textAlign: "center",
              justifyContent: "center",
              margin: "36px 0 28px",
            }}
          >
            {scriptName(name)}
          </div>
          <div style={{ display: "flex", width: 90, height: 2, background: GOLD, marginBottom: 70 }} />
          <div style={{ display: "flex", padding: 26, background: "#fff", borderRadius: 28 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="" width={520} height={520} />
          </div>
          <div style={{ display: "flex", fontSize: 40, color: PAPER, marginTop: 64 }}>Book online in a minute</div>
          <div style={{ display: "flex", fontSize: 30, color: GOLD, marginTop: 18, letterSpacing: 2 }}>Link in bio</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, fonts }
  );
}

export async function cardImage({ name, link }) {
  const [fonts, qr] = await Promise.all([loadFonts(), qrDataUrl(link, 900)]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: PAPER,
          fontFamily: "Inter",
          padding: "0 110px",
        }}
      >
        <div style={{ display: "flex", fontSize: 44, letterSpacing: 16, color: "#6b655b", textTransform: "uppercase", paddingLeft: 16 }}>
          Scan to book
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: "Great Vibes",
            fontSize: nameSize(name, 200),
            lineHeight: 1.1,
            color: INK,
            textAlign: "center",
            justifyContent: "center",
            margin: "40px 0 34px",
          }}
        >
          {scriptName(name)}
        </div>
        <div style={{ display: "flex", width: 120, height: 3, background: GOLD, marginBottom: 80 }} />
        <div style={{ display: "flex", padding: 30, background: "#fff", border: `3px solid ${INK}`, borderRadius: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="" width={840} height={840} />
        </div>
        <div style={{ display: "flex", fontSize: 38, color: INK, marginTop: 80, textAlign: "center" }}>
          Point your phone&apos;s camera at the code
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#6b655b", marginTop: 20, textAlign: "center" }}>{shortLink(link)}</div>
      </div>
    ),
    { width: 1500, height: 2100, fonts }
  );
}
