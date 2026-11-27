// Reads a pro's old service menu from screenshots with Claude (vision) and
// returns the services as JSON (lib/serviceImport.js EXTRACT_SCHEMA).
// Server only: the key is ANTHROPIC_API_KEY in Vercel and never reaches the
// browser. Returns { extracted } or { error } with a message for the pro.
import Anthropic from "@anthropic-ai/sdk";
import { EXTRACT_SCHEMA } from "@/lib/serviceImport";
import { reportError } from "@/lib/errorAlerts";

const MODEL = "claude-opus-5-5";

const SYSTEM = `You read screenshots of an independent pro's service menu from another booking app or social media (Booksy, GlossGenius, Square, Vagaro, StyleSeat, Instagram posts or stories, price lists). Pros are hair stylists, barbers, tattoo artists and tutors.

List every bookable service you can see, once, in the order shown:
- name: exactly as written, without the price or time.
- price: the price text as shown, e.g. "$85", "from $220", "$45+", "Free". Use "" if no price is shown.
- duration_minutes: the length in minutes when the screenshot shows it ("1 hr 30 min" = 90). Use null when it isn't shown. Never guess a duration.
- category: the section heading it sits under, e.g. "Braids" or "Color". "" if there isn't one.
- description: the short description shown under it, if any. "" if none.

Skip add-ons shown only as options inside another service, deposits, policies, tips, reviews and anything that isn't a service. If the same service appears on two screenshots, list it once.
In "unreadable", list the 1-based number of every screenshot that has no service menu you can read (blurry, cut off, or not a menu).`;

let client;
const anthropic = () => (client ??= new Anthropic());

// images: [{ data: base64 string, mediaType: "image/jpeg" | "image/png" | "image/webp" }]
export async function extractServicesFromScreenshots(images) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "Reading screenshots isn't switched on yet. Please add your services by hand for now, or try again later." };
  }
  const content = [];
  images.forEach((img, i) => {
    content.push({ type: "text", text: `Screenshot ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
  });
  content.push({ type: "text", text: "List the services from these screenshots." });

  let response;
  try {
    response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      // Copying a menu doesn't need deep thought; low effort keeps it quick.
      output_config: { effort: "low", format: { type: "json_schema", schema: EXTRACT_SCHEMA } },
      messages: [{ role: "user", content }],
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return { error: "Lots of people are importing right now. Please try again in a minute." };
    }
    if (error instanceof Anthropic.BadRequestError && /image/i.test(error.message || "")) {
      return { error: "One of those screenshots couldn't be opened. Please try different screenshots (JPEG or PNG)." };
    }
    await reportError("Services import", error, { extra: error instanceof Anthropic.APIError ? `Anthropic status ${error.status || "?"}` : "" });
    return { error: "We couldn't read your screenshots just now. Please try again in a minute." };
  }

  if (response.stop_reason === "refusal") {
    return { error: "We couldn't read those screenshots. Please try screenshots of just your service menu." };
  }
  if (response.stop_reason === "max_tokens") {
    return { error: "That's a big menu! Please import it in two parts (5 screenshots at a time)." };
  }
  const textBlock = response.content.find((b) => b.type === "text");
  try {
    const extracted = JSON.parse(textBlock?.text || "");
    return { extracted };
  } catch (error) {
    await reportError("Services import", error, { extra: "Claude's answer wasn't valid JSON" });
    return { error: "We couldn't read your screenshots just now. Please try again." };
  }
}
