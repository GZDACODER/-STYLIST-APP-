// A signed agreement as a PDF: the exact text, the signature image, who
// signed and when, and the IP address and device. Used for pro agreements
// (layer 1) and client waivers (layer 2). Server only.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const INK = rgb(0.07, 0.06, 0.05);
const MUTED = rgb(0.42, 0.4, 0.36);
const GOLD = rgb(0.66, 0.53, 0.3);

// Splits text into lines that fit `width` at `size` (keeps blank lines).
function wrap(text, font, size, width) {
  const lines = [];
  for (const para of String(text).replace(/\r/g, "").split("\n")) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines;
}

// Standard PDF fonts can't draw every character; swap the common ones.
const clean = (s) =>
  String(s ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/¢/g, " cents")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");

/**
 * title, text: the agreement; signer: { legalName, businessName?, role? };
 * signedAt: Date; ip, userAgent; signaturePng: Uint8Array; footer: string.
 * Returns the PDF as Uint8Array.
 */
export async function agreementPdf({ title, text, signer, signedAt, ip, userAgent, signaturePng, footer }) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const W = 612;
  const H = 792;
  const M = 56;
  let page = pdf.addPage([W, H]);
  let y = H - M;

  const newPageIfNeeded = (need) => {
    if (y - need < M) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  };

  page.drawRectangle({ x: M, y: y - 2, width: 28, height: 1, color: GOLD });
  y -= 22;
  page.drawText(clean(title), { x: M, y, size: 22, font: serif, color: INK });
  y -= 30;

  for (const line of wrap(clean(text), font, 10.5, W - 2 * M)) {
    newPageIfNeeded(16);
    if (line) page.drawText(line, { x: M, y, size: 10.5, font, color: INK });
    y -= 15;
  }

  // The signature block.
  newPageIfNeeded(190);
  y -= 14;
  page.drawRectangle({ x: M, y, width: W - 2 * M, height: 0.8, color: INK });
  y -= 22;
  page.drawText("Signed by", { x: M, y, size: 9, font: bold, color: MUTED });
  y -= 16;
  page.drawText(clean(signer.legalName), { x: M, y, size: 13, font: bold, color: INK });
  y -= 15;
  const sub = [signer.role, signer.businessName].filter(Boolean).map(clean).join(" · ");
  if (sub) {
    page.drawText(sub, { x: M, y, size: 10, font, color: MUTED });
    y -= 14;
  }
  if (signaturePng) {
    const img = await pdf.embedPng(signaturePng);
    const scale = Math.min(220 / img.width, 80 / img.height, 1);
    y -= img.height * scale + 6;
    page.drawImage(img, { x: M, y, width: img.width * scale, height: img.height * scale });
    y -= 8;
  }
  const meta = [
    `Signed ${signedAt.toISOString().replace("T", " ").slice(0, 19)} UTC`,
    ip ? `IP address ${clean(ip)}` : null,
    userAgent ? `Device ${clean(userAgent).slice(0, 110)}` : null,
  ].filter(Boolean);
  for (const m of meta) {
    page.drawText(m, { x: M, y, size: 8.5, font, color: MUTED });
    y -= 12;
  }
  if (footer) {
    y -= 6;
    for (const line of wrap(clean(footer), font, 8, W - 2 * M)) {
      newPageIfNeeded(12);
      page.drawText(line, { x: M, y, size: 8, font, color: MUTED });
      y -= 11;
    }
  }
  return pdf.save();
}
