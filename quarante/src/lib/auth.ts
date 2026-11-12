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

// ── The birthday girl's own login (password set by the host in the admin)
const HER = "q40_her";

export function checkHerPassword(attempt: string, actual: string): boolean {
  if (!actual) return false;
  const a = Buffer.from(sign("her:" + attempt.trim().toLowerCase()));
  const b = Buffer.from(sign("her:" + actual.trim().toLowerCase()));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The cookie is bound to the current password, so changing it signs her out. */
export function setHerCookie(password: string) {
  const exp = Date.now() + MAX_AGE * 1000;
  cookies().set(HER, `${exp}.${sign(`her:${exp}:${password}`)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: MAX_AGE, path: "/" });
}

export function isHer(password: string): boolean {
  if (!password) return false;
  const raw = cookies().get(HER)?.value;
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = sign(`her:${exp}:${password}`);
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
