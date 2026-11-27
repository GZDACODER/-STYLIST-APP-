"use server";

// Saves a pro's signed Clientele agreement (layer 1): the signature image
// and a PDF copy in private storage, a permanent record of exactly what was
// signed, and an email with the PDF.
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRO_TERMS, PRO_TERMS_VERSION, proTermsText } from "@/lib/agreements";
import { agreementPdf } from "@/lib/agreementPdf";
import { emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { isDemo } from "@/lib/demo";

export async function signProTerms(prev, formData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) redirect("/dashboard");

  const checks = Object.fromEntries(PRO_TERMS.checks.map((c) => [c.key, formData.get(`check_${c.key}`) === "on"]));
  if (!Object.values(checks).every(Boolean)) return { error: "Please tick all three boxes." };
  const legalName = String(formData.get("legal_name") || "").trim().replace(/\s+/g, " ");
  const businessName = String(formData.get("business_name") || "").trim().replace(/\s+/g, " ");
  if (legalName.length < 2 || !legalName.includes(" ")) return { error: "Please type your full legal name (first and last)." };
  if (!businessName) return { error: "Please type your business name." };
  const sig = String(formData.get("signature") || "");
  const m = sig.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!m || m[1].length < 400) return { error: "Please sign in the box." };
  if (m[1].length > 400000) return { error: "That signature is too large. Please clear it and sign again." };
  const png = Buffer.from(m[1], "base64");

  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || null;
  const userAgent = (h.get("user-agent") || "").slice(0, 300) || null;
  const signedAt = new Date();
  const text = proTermsText();
  const admin = createAdminClient();
  const stamp = signedAt.toISOString().replace(/[:.]/g, "-");
  const base = `${user.id}/pro-terms-v${PRO_TERMS_VERSION}-${stamp}`;

  const up1 = await admin.storage.from("agreements").upload(`${base}.png`, png, { contentType: "image/png" });
  if (up1.error) return { error: "Couldn't save your signature. Please try again." };
  const pdf = await agreementPdf({
    title: PRO_TERMS.title,
    text,
    signer: { legalName, businessName, role: "Business owner" },
    signedAt,
    ip,
    userAgent,
    signaturePng: png,
    footer: `Signed electronically at clientelesuite.com. Account: ${user.email}. Agreement version ${PRO_TERMS_VERSION}.`,
  });
  const up2 = await admin.storage.from("agreements").upload(`${base}.pdf`, pdf, { contentType: "application/pdf" });

  const { error } = await admin.from("pro_agreements").insert({
    stylist_id: user.id,
    kind: "pro_terms",
    version: PRO_TERMS_VERSION,
    signed_at: signedAt.toISOString(),
    legal_name: legalName,
    business_name: businessName,
    checks,
    text_signed: text,
    signature_path: `${base}.png`,
    pdf_path: up2.error ? null : `${base}.pdf`,
    ip,
    user_agent: userAgent,
  });
  if (error) return { error: "Couldn't save your agreement. Please try again." };

  if (emailConfigured() && user.email && !up2.error) {
    await sendEmails([
      {
        to: user.email,
        subject: "Your signed Clientele agreement",
        html: emailLayout("Your signed agreement", [
          `<p>Hi ${escapeHtml(legalName.split(" ")[0])},</p>`,
          `<p>Thanks for signing. Your copy of the Clientele agreement is attached as a PDF. You can also find it any time in Settings.</p>`,
        ]),
        text: "Thanks for signing. Your copy of the Clientele agreement is attached as a PDF.",
        attachments: [{ filename: "Clientele-agreement.pdf", content: Buffer.from(pdf).toString("base64") }],
      },
    ]).catch(() => {});
  }
  // New pros who came from "Start free" go straight to Import your services.
  const jar = await cookies();
  if (jar.get("cl_after_signup")?.value === "import") {
    jar.delete("cl_after_signup");
    redirect("/dashboard/services/import");
  }
  redirect("/dashboard");
}
