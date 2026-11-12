import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Plain-words check of the setup. Open /api/health on the live site. Reveals no secrets. */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const checks: Record<string, string> = {
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? "set" : "MISSING: add it in Vercel and redeploy",
    NEXT_PUBLIC_SUPABASE_URL: !url ? "MISSING" : /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) ? "set" : `looks wrong: should be https://<code>.supabase.co, nothing after it`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anon ? "set" : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: service ? "set" : "MISSING",
  };
  let database = "not checked (keys missing)";
  let storage = "not checked (keys missing)";
  if (url && service) {
    try {
      const sb = createClient(url, service, { auth: { persistSession: false } });
      const { error } = await sb.from("rooms").select("code").limit(1);
      database = error
        ? /does not exist|schema cache/i.test(error.message)
          ? "tables missing: run supabase/schema.sql in the Supabase SQL Editor"
          : `error: ${error.message}`
        : "ok";
      const st = await sb.storage.getBucket("party");
      storage = st.error ? "photo bucket missing: run supabase/schema.sql again" : "ok";
    } catch (e) {
      database = `could not connect: ${(e as Error).message}`;
    }
  }
  const allOk = Object.values(checks).every((v) => v === "set") && database === "ok" && storage === "ok";
  return NextResponse.json(
    { verdict: allOk ? "Everything is connected. The game should work." : "Something needs fixing: see below.", settings: checks, database, storage },
    { headers: { "Cache-Control": "no-store" } },
  );
}
