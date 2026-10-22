import type { Context } from "@netlify/functions";
import { z } from "zod";
import { guard, json } from "./_lib/cors.ts";
import { verifyTurnstile } from "./_lib/turnstile.ts";
export default async function handler(req: Request, context: Context): Promise<Response> {
  const denied = guard(req);
  if (denied) return denied;
  const parsed = z
    .object({ token: z.string().min(1).max(2048) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ success: false }, 400);
  try {
    return json({ success: await verifyTurnstile(parsed.data.token, context.ip) });
  } catch {
    return json({ success: false }, 503);
  }
}
