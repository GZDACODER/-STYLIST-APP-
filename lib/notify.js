// Sending emails (with Resend) and text messages (with Twilio). Server code only.
//
// Emails need RESEND_API_KEY and EMAIL_FROM in Vercel.
// Texts stay off until TEXT_MESSAGES=on is added in Vercel, along with
// TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (see WAITLIST_SETUP.md).

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function textsEnabled() {
  return (
    String(process.env.TEXT_MESSAGES || "").toLowerCase() === "on" &&
    Boolean(
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM
    )
  );
}

async function resend(path, body) {
  const response = await fetch(`https://api.resend.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Resend said ${response.status}: ${await response.text()}`);
  }
}

function toResend({ to, subject, html, text, replyTo }) {
  return {
    from: process.env.EMAIL_FROM,
    to: [to],
    subject,
    html,
    text,
    ...(replyTo ? { reply_to: replyTo } : {}),
  };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Sends emails: [{ to, subject, html, text, replyTo }].
// Returns { ok, error } for each one: did it send, and if not, Resend's reason.
export async function sendEmails(messages) {
  if (!messages.length) return [];

  // Shows in Vercel's logs: which reply address each email carries, so a
  // missing Reply-To is easy to spot.
  for (const m of messages) {
    console.log(`Sending "${String(m.subject).slice(0, 60)}" with reply-to: ${m.replyTo || "none"}`);
  }

  // Up to 100 at once in one request.
  if (messages.length > 1) {
    try {
      for (let i = 0; i < messages.length; i += 100) {
        await resend("/emails/batch", messages.slice(i, i + 100).map(toResend));
      }
      return messages.map(() => ({ ok: true }));
    } catch (error) {
      // One bad address fails the whole batch, so send them one by one instead.
      console.error("Email batch failed, sending one at a time", error.message);
    }
  }

  const results = [];
  for (const message of messages) {
    try {
      await resend("/emails", toResend(message));
      results.push({ ok: true });
    } catch (error) {
      console.error("Couldn't send email", error.message);
      results.push({ ok: false, error: error.message });
    }
    // Resend allows a few emails per second.
    if (messages.length > 1) await wait(600);
  }
  return results;
}

// Sends one text message. "to" is a number like "+15551234567".
export async function sendText(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const from = process.env.TWILIO_FROM;
  const form = new URLSearchParams({ To: to, Body: body });
  // TWILIO_FROM is a phone number (+1555...) or a Messaging Service (MG...).
  if (from.startsWith("MG")) form.set("MessagingServiceSid", from);
  else form.set("From", from);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Twilio said ${response.status}: ${await response.text()}`);
  }
}

// Makes text safe to put inside an email's HTML.
export function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// The email look, matching the site's printed "Atelier" style: warm paper,
// a black plate framed with a fine gold line holding the heading, a sharp
// paper sheet with an ink rule on top, squared ink buttons in tracked
// capitals and a small "Sent with Clientele" line. Tables and inline styles
// so it holds together in Gmail, Apple Mail and Outlook.
// parts: strings of HTML (already escaped).
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif";

export function emailLayout(heading, parts) {
  return `<!doctype html>
<html><head><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:0;background:#f3eee5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3eee5;">
<tr><td align="center" style="padding:28px 14px 36px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="background:#12100d;padding:9px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="border:1px solid #8a7343;padding:26px 24px 24px;">
<div style="width:28px;height:1px;background:#cfae6c;line-height:1px;font-size:1px;margin:0 0 14px;">&nbsp;</div>
<h1 style="margin:0;font-family:${SERIF};font-weight:normal;font-size:30px;line-height:1.12;color:#fbf6ea;">${heading}</h1>
</td></tr></table>
</td></tr>
<tr><td style="background:#fbf8f2;border:1px solid #ddd4c3;border-top:0;padding:26px 24px 24px;font-family:${SANS};font-size:15px;line-height:1.6;color:#12100d;">
${parts.join("\n")}
</td></tr>
<tr><td align="center" style="padding:18px 0 0;font-family:${SANS};font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#8a8275;">
Sent with <span style="font-family:${SERIF};font-style:italic;font-size:13px;letter-spacing:0.02em;text-transform:none;color:#a8874d;">Clientele</span>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// A squared ink button in tracked capitals. outline: a thin ink frame
// instead (for less important links).
export function emailButton(href, label, { outline = false } = {}) {
  const colors = outline
    ? "background:#fbf8f2;color:#12100d;border:1px solid #12100d;"
    : "background:#12100d;color:#fbf6ea;border:1px solid #12100d;border-bottom:2px solid #cfae6c;";
  return `<a href="${escapeHtml(href)}" style="display:inline-block;${colors}text-decoration:none;font-family:${SANS};font-weight:600;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;padding:13px 22px;border-radius:2px;">${escapeHtml(label)}</a>`;
}
