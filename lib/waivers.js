// Client waivers (layer 2): after a response is saved, keep the drawn
// signature and a PDF copy in private storage, link them to the response,
// and email the PDF to the client. Server only.
// NOTE: starter waivers are templates; a lawyer must review them.
import { createAdminClient } from "@/lib/supabase/admin";
import { agreementPdf } from "@/lib/agreementPdf";
import { emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";

// A signature from the pad: a PNG data URL -> bytes, or null.
export function signatureBytes(dataUrl) {
  const m = String(dataUrl || "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!m || m[1].length < 400 || m[1].length > 400000) return null;
  return Buffer.from(m[1], "base64");
}

export async function uploadSignature(stylistId, png) {
  const path = `${stylistId}/sig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const { error } = await createAdminClient().storage.from("waivers").upload(path, png, { contentType: "image/png" });
  return error ? null : path;
}

/**
 * Makes and saves the PDF for a signed response, links signature and PDF,
 * and emails it. r: { responseId, stylistId, businessName, signerName,
 * waiverText, answers: [{label, answer}], forMinor, guardianName,
 * guardianRelation, signaturePath, png, ip, userAgent, email, bookingId }
 */
export async function finishWaiver(r) {
  const admin = createAdminClient();
  const signedAt = new Date();
  const lines = [
    `Waiver for ${r.businessName}`,
    "",
    r.waiverText || "",
    "",
    ...(r.answers?.length ? ["Answers:", ...r.answers.map((a) => `${a.label}: ${a.answer || "-"}`), ""] : []),
    r.forMinor ? `Signed by a parent or guardian (${r.guardianRelation || "guardian"}) for someone under 18: ${r.signerName}` : "",
  ];
  let pdfPath = null;
  try {
    const pdf = await agreementPdf({
      title: `Waiver · ${r.businessName}`,
      text: lines.join("\n"),
      signer: { legalName: r.forMinor ? r.guardianName || r.signerName : r.signerName, role: r.forMinor ? `Parent/guardian for ${r.signerName}` : "Client", businessName: r.businessName },
      signedAt,
      ip: r.ip,
      userAgent: r.userAgent,
      signaturePng: r.png,
      footer: "Signed electronically through Clientele (clientelesuite.com).",
    });
    pdfPath = `${r.stylistId}/waiver-${r.responseId}.pdf`;
    const up = await admin.storage.from("waivers").upload(pdfPath, pdf, { contentType: "application/pdf", upsert: true });
    if (up.error) pdfPath = null;
    if (pdfPath && r.email && emailConfigured()) {
      await sendEmails([
        {
          to: r.email,
          subject: `Your signed waiver for ${r.businessName}`,
          html: emailLayout("Your signed waiver", [
            `<p>Thanks for signing. Your copy of the waiver for ${escapeHtml(r.businessName)} is attached as a PDF.</p>`,
          ]),
          text: `Thanks for signing. Your copy of the waiver for ${r.businessName} is attached as a PDF.`,
          attachments: [{ filename: "Waiver.pdf", content: Buffer.from(pdf).toString("base64") }],
        },
      ]).catch(() => {});
    }
  } catch (error) {
    console.error("Couldn't make the waiver PDF", error?.message);
  }
  await admin.rpc("intake_attach_signature", {
    p_response_id: r.responseId,
    p_signature_path: r.signaturePath,
    p_pdf_path: pdfPath,
    p_for_minor: Boolean(r.forMinor),
    p_guardian_name: r.guardianName || null,
    p_guardian_relation: r.guardianRelation || null,
    p_booking_id: r.bookingId || null,
  });
  return pdfPath;
}
