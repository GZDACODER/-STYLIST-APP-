// Error alerts: when something breaks, the owner (ADMIN_EMAILS in Vercel) gets
// an email, and it's listed at /dashboard/admin/errors. The same problem is
// emailed at most once an hour (see 0046_error_alerts.sql). Server code only.
//
// reportError never throws, so it's safe inside any catch block.
import { createAdminClient } from "@/lib/supabase/admin";
import { adminEmails } from "@/lib/admin";
import { emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { publicSiteUrl } from "@/lib/siteUrl";

// Without the table (SQL not run yet), fall back to a per-server memory so a
// burst of the same error still sends only one email.
const recent = new Map();

function describe(error) {
  if (error instanceof Error) {
    const stack = String(error.stack || "")
      .split("\n")
      .slice(1, 8)
      .map((l) => l.trim())
      .join("\n");
    return { message: error.message || error.name || "Error", stack, digest: error.digest };
  }
  if (error && typeof error === "object") {
    return { message: String(error.message || JSON.stringify(error)).slice(0, 2000), stack: "", digest: error.digest };
  }
  return { message: String(error), stack: "", digest: undefined };
}

// The same problem with different ids, dates or numbers counts as one.
function signatureOf(source, message) {
  const normalized = String(message)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\b(pi|cs|ch|dp|evt|cus|sub|acct|in|re|tr)_[A-Za-z0-9]+/g, "<$1>")
    .replace(/\d+/g, "#")
    .slice(0, 200);
  return `${source}: ${normalized}`;
}

export async function reportError(source, error, { path = "", extra = "" } = {}) {
  try {
    const { message, stack, digest } = describe(error);
    console.error(`[alert] ${source}${path ? ` ${path}` : ""}:`, message);
    const signature = signatureOf(source, message);
    const detail = [extra && String(extra).slice(0, 2000), digest && `Digest: ${digest}`, stack].filter(Boolean).join("\n\n");

    let seen = 1;
    let send = true;
    try {
      const admin = createAdminClient();
      const { data, error: dbError } = await admin.rpc("note_error", {
        p_signature: signature,
        p_source: source,
        p_message: message,
        p_detail: detail || null,
        p_path: path || null,
      });
      if (dbError) throw dbError;
      const row = Array.isArray(data) ? data[0] : data;
      seen = row?.seen || 1;
      send = Boolean(row?.send_email);
      if (Math.random() < 0.02) await admin.rpc("prune_error_alerts", {});
    } catch {
      const last = recent.get(signature) || 0;
      send = Date.now() - last > 60 * 60 * 1000;
      if (send) recent.set(signature, Date.now());
    }

    const to = adminEmails();
    if (!send || !to.length || !emailConfigured()) return;
    const list = `${publicSiteUrl("https://www.clientelesuite.com")}/dashboard/admin/errors`;
    await sendEmails(
      to.map((address) => ({
        to: address,
        subject: `Clientele error: ${source} · ${message.slice(0, 70)}`,
        html: emailLayout("Something broke on Clientele", [
          `<p><strong>${escapeHtml(source)}</strong>${path ? ` · ${escapeHtml(path)}` : ""}</p>`,
          `<p>${escapeHtml(message)}</p>`,
          seen > 1 ? `<p>Seen ${seen} times so far. You'll hear about this one at most once an hour.</p>` : "",
          detail ? `<pre style="white-space:pre-wrap;font-size:12px;background:#f6f6f6;padding:10px;border-radius:6px">${escapeHtml(detail)}</pre>` : "",
          `<p><a href="${list}">See all recent errors</a> · Vercel → Logs has the full details.</p>`,
        ]),
        text: `${source}${path ? ` · ${path}` : ""}\n${message}\n${seen > 1 ? `Seen ${seen} times.\n` : ""}\n${detail}\n\n${list}`,
      }))
    );
  } catch (failure) {
    console.error("Couldn't send an error alert", failure?.message || failure);
  }
}
