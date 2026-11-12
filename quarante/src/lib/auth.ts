import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "q40_admin";
const MAX_AGE = 60 * 60 * 24 * 14;

export function adminPassword(): string | null {
  const p = process.env.ADMIN_PASSWORD;
  if (p) return p;
  return process.env.NODE_ENV === "production" ? null : "quarante"; // dev-only default
}

function sign(value: string): string {
  const secret = (process.env.ADMIN_PASSWORD || "dev") + ":" + (process.env.SUPABASE_SERVICE_ROLE_KEY || "local");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function checkPassword(attempt: string): boolean {
  const p = adminPassword();
  if (!p) return false;
  const a = Buffer.from(sign(attempt));
  const b = Buffer.from(sign(p));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function setAdminCookie() {
  const exp = Date.now() + MAX_AGE * 1000;
  const token = `${exp}.${sign(String(exp))}`;
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: MAX_AGE, path: "/" });
}

export function clearAdminCookie() {
  cookies().delete(COOKIE);
}

export function isAdmin(): boolean {
  if (!adminPassword()) return false;
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = sign(exp);
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
