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
// Returns true or false for each one (did it send?).
export async function sendEmails(messages) {
  if (!messages.length) return [];

  // Up to 100 at once in one request.
  if (messages.length > 1) {
    try {
      for (let i = 0; i < messages.length; i += 100) {
        await resend("/emails/batch", messages.slice(i, i + 100).map(toResend));
      }
      return messages.map(() => true);
    } catch (error) {
      // One bad address fails the whole batch, so send them one by one instead.
      console.error("Email batch failed, sending one at a time", error.message);
    }
  }

  const results = [];
  for (const message of messages) {
    try {
      await resend("/emails", toResend(message));
      results.push(true);
    } catch (error) {
      console.error("Couldn't send email", error.message);
      results.push(false);
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

// A simple email layout: a heading, paragraphs and gold buttons.
// parts: strings of HTML (already escaped).
export function emailLayout(heading, parts) {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f3ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1a16;">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:28px;border:1px solid #e8dfc8;">
<h1 style="font-size:22px;margin:0 0 16px;">${heading}</h1>
${parts.join("\n")}
</div>
</body></html>`;
}

export function emailButton(href, label) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#c9a646;color:#14110a;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px;">${escapeHtml(label)}</a>`;
}
