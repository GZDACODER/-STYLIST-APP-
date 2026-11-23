"use server";

import { unfollowByToken } from "@/lib/followers";

export async function undoStop(prev, formData) {
  const r = await unfollowByToken(String(formData.get("token") || ""), true);
  return r ? { ok: true } : { error: "This link doesn't work any more." };
}
