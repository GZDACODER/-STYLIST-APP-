// The 1200 x 630 preview image shown when a link is shared (iMessage,
// WhatsApp, Instagram, Facebook, X...). Server code only.
//   - No photo: black, a gold cursive name in the middle, and a small line
//     of spaced capitals under it.
//   - With a cover photo: the photo filling the card, a black fade at the
//     bottom, and the name and line over it.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

const GOLD = "#c8a96a";
const GOLD_LIGHT = "#e6cd7e";
const PAPER = "#f5f1ea";

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

// Long names get a smaller script size so they stay on the card.
function nameSize(name, withPhoto) {
  const n = String(name || "").length;
  const big = withPhoto ? 120 : 150;
  if (n <= 12) return big;
  if (n <= 20) return Math.round(big * 0.78);
  if (n <= 30) return Math.round(big * 0.6);
  return Math.round(big * 0.48);
}

export async function brandCard({ name, line, photoUrl = null }) {
  const fonts = await loadFonts();
  // The script font sets words almost touching, so use wider spaces.
  const scriptName = String(name || "").trim().split(/\s+/).join("\u2002");
  const withPhoto = Boolean(photoUrl);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#0e0d0b",
          fontFamily: "Inter",
        }}
      >
        {withPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            width={1200}
            height={630}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {withPhoto && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              backgroundImage:
                "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0) 65%)",
            }}
          />
        )}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            alignItems: withPhoto ? "flex-start" : "center",
            justifyContent: withPhoto ? "flex-end" : "center",
            padding: withPhoto ? "0 72px 64px" : "0 72px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Great Vibes",
              fontSize: nameSize(name, withPhoto),
              lineHeight: 1.15,
              color: withPhoto ? PAPER : GOLD_LIGHT,
              textAlign: withPhoto ? "left" : "center",
              padding: "0 12px",
            }}
          >
            {scriptName}
          </div>
          <div
            style={{
              display: "flex",
              width: 72,
              height: 2,
              background: GOLD,
              margin: withPhoto ? "18px 0 22px 12px" : "22px 0 26px",
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 26,
              letterSpacing: 9,
              textTransform: "uppercase",
              color: withPhoto ? PAPER : GOLD,
              paddingLeft: withPhoto ? 12 : 9,
            }}
          >
            {line}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts }
  );
}
