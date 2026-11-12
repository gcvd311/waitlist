import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mergeContent } from "./contentMerge";
export { mergeContent };
import { GameError, ONLINE_WINDOW_MS } from "./engine";
import type { Content, RoomState } from "./types";

// Two interchangeable backends:
//  • Supabase  (when env vars are present): rooms + content in Postgres, pulses via Realtime.
//  • Memory    (local dev, zero setup):      everything in this Node process; clients poll.

const ROOM_TTL_MS = 1000 * 60 * 60 * 18; // room codes are temporary
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export const hasSupabase = () =>
  !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_sb) {
    _sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return _sb;
}

type Mem = {
  rooms: Map<string, { state: RoomState; version: number; hostToken: string; expiresAt: number }>;
  presence: Map<string, Map<string, number>>;
  content: Content | null;
};
const g = globalThis as unknown as { __quarante?: Mem };
const mem: Mem = (g.__quarante ??= { rooms: new Map(), presence: new Map(), content: null });

export function newCode(): string {
  let s = "";
  const arr = new Uint32Array(4);
  globalThis.crypto.getRandomValues(arr);
  for (let i = 0; i < 4; i++) s += CODE_CHARS[arr[i] % CODE_CHARS.length];
  return s;
}

// ───────────────────────── content ─────────────────────────

export async function getContent(): Promise<Content> {
  if (!hasSupabase()) return mergeContent(mem.content);
  const { data, error } = await sb().from("game_content").select("content").eq("id", "default").maybeSingle();
  if (error) throw new GameError(`Database error: ${error.message}`, 500);
  return mergeContent(data?.content as Content | undefined);
}

export async function saveContent(content: Content): Promise<Content> {
  const next = { ...content, updatedAt: Date.now() };
  if (!hasSupabase()) {
    mem.content = next;
    return next;
  }
  const { error } = await sb().from("game_content").upsert({ id: "default", content: next, updated_at: new Date().toISOString() });
  if (error) throw new GameError(`Database error: ${error.message}`, 500);
  return next;
}

/** Atomic-ish content edit (used by the public confession form). */
export async function mutateContent(fn: (c: Content) => void): Promise<void> {
  const c = await getContent();
  fn(c);
  await saveContent(c);
}

export async function uploadPhoto(dataUrl: string): Promise<string> {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) throw new GameError("Unsupported image.");
  if (!hasSupabase()) return dataUrl; // local mode keeps the (already resized) image inline
  const ext = m[1].split("/")[1];
  const path = `photos/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await sb().storage.from(BUCKET).upload(path, Buffer.from(m[2], "base64"), { contentType: m[1], upsert: false });
  if (error) throw new GameError(`Upload failed: ${error.message}`, 500);
  return `sb://${path}`; // a private reference; screens get short-lived signed links
}

// ───────────────────────── private photos ─────────────────────────
// Photos live in a private bucket. Stored content holds "sb://path" references;
// every response swaps them for signed links that expire, and saves swap them back.

const BUCKET = "party";
const SIGN_SECONDS = 6 * 3600;
const signed = new Map<string, { url: string; exp: number }>();

function collect(v: unknown, out: Set<string>) {
  if (typeof v === "string") {
    if (v.startsWith("sb://")) out.add(v);
  } else if (Array.isArray(v)) v.forEach((x) => collect(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => collect(x, out));
}

export async function resolvePhotos<T>(obj: T): Promise<T> {
  if (!hasSupabase()) return obj;
  const refs = new Set<string>();
  collect(obj, refs);
  if (!refs.size) return obj;
  const soon = Date.now() + 15 * 60_000;
  const need = [...refs].filter((r) => !((signed.get(r)?.exp ?? 0) > soon));
  if (need.length) {
    const { data } = await sb().storage.from(BUCKET).createSignedUrls(need.map((r) => r.slice(5)), SIGN_SECONDS);
    (data ?? []).forEach((d, i) => d.signedUrl && signed.set(need[i], { url: d.signedUrl, exp: Date.now() + SIGN_SECONDS * 1000 }));
  }
  return JSON.parse(JSON.stringify(obj), (_k, v) => (typeof v === "string" && v.startsWith("sb://") ? signed.get(v)?.url ?? "" : v));
}

/** Turn signed (or older public) storage links back into references before saving. */
export function unresolvePhotos<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj), (_k, v) => {
    if (typeof v !== "string") return v;
    const m = /\/storage\/v1\/object\/(?:sign|public)\/party\/([^?]+)/.exec(v);
    return m && v.startsWith("http") ? `sb://${decodeURIComponent(m[1])}` : v;
  });
}

// ───────────────────────── rooms ─────────────────────────

export async function createRoom(make: (code: string) => RoomState, hostToken: string): Promise<RoomState> {
  const now = Date.now();
  if (!hasSupabase()) {
    for (const [k, r] of mem.rooms) if (r.expiresAt < now) mem.rooms.delete(k);
    let code = newCode();
    while (mem.rooms.has(code)) code = newCode();
    const state = make(code);
    mem.rooms.set(code, { state, version: 1, hostToken, expiresAt: now + ROOM_TTL_MS });
    return state;
  }
  await sb().from("rooms").delete().lt("expires_at", new Date(now).toISOString());
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = newCode();
    const state = make(code);
    const { error } = await sb().from("rooms").insert({
      code,
      state,
      version: 1,
      host_token: hostToken,
      expires_at: new Date(now + ROOM_TTL_MS).toISOString(),
    });
    if (!error) {
      await pulse(code, 1);
      return state;
    }
    if (!/duplicate|unique/i.test(error.message)) throw new GameError(`Database error: ${error.message}`, 500);
  }
  throw new GameError("Could not allocate a room code.", 500);
}

export async function getRoom(code: string): Promise<{ state: RoomState; version: number; hostToken: string }> {
  code = code.toUpperCase();
  if (!hasSupabase()) {
    const r = mem.rooms.get(code);
    if (!r || r.expiresAt < Date.now()) throw new GameError("Room not found. Check the code.", 404);
    return r;
  }
  const { data, error } = await sb().from("rooms").select("state, version, host_token, expires_at").eq("code", code).maybeSingle();
  if (error) throw new GameError(`Database error: ${error.message}`, 500);
  if (!data || new Date(data.expires_at).getTime() < Date.now()) throw new GameError("Room not found. Check the code.", 404);
  return { state: data.state as RoomState, version: data.version, hostToken: data.host_token };
}

async function pulse(code: string, version: number) {
  await sb().from("room_pulse").upsert({ code, version, updated_at: new Date().toISOString() });
}

/**
 * Read-modify-write with optimistic concurrency. Ten phones answering in the same
 * second collide; the loser re-reads and re-applies, so nothing is lost.
 */
export async function mutateRoom<T>(code: string, fn: (state: RoomState) => T): Promise<{ state: RoomState; result: T }> {
  code = code.toUpperCase();
  if (!hasSupabase()) {
    const r = await getRoom(code);
    const draft = structuredClone(r.state);
    const result = fn(draft); // throws leave the stored state untouched
    r.state = draft;
    r.version++;
    return { state: draft, result };
  }
  for (let attempt = 0; attempt < 12; attempt++) {
    const { state, version } = await getRoom(code);
    const result = fn(state);
    const { data, error } = await sb()
      .from("rooms")
      .update({ state, version: version + 1, updated_at: new Date().toISOString() })
      .eq("code", code)
      .eq("version", version)
      .select("version");
    if (error) throw new GameError(`Database error: ${error.message}`, 500);
    if (data && data.length) {
      await pulse(code, version + 1);
      return { state, result };
    }
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 60 * (attempt + 1)));
  }
  throw new GameError("The room is busy. Try again.", 503);
}

// ───────────────────────── presence ─────────────────────────

export async function touch(code: string, pid: string): Promise<void> {
  code = code.toUpperCase();
  if (!hasSupabase()) {
    if (!mem.presence.has(code)) mem.presence.set(code, new Map());
    mem.presence.get(code)!.set(pid, Date.now());
    return;
  }
  await sb().from("room_presence").upsert({ code, player_id: pid, seen_at: new Date().toISOString() });
}

export async function onlineSet(code: string): Promise<Set<string>> {
  code = code.toUpperCase();
  const cutoff = Date.now() - ONLINE_WINDOW_MS;
  if (!hasSupabase()) {
    const m = mem.presence.get(code);
    return new Set(m ? [...m].filter(([, t]) => t > cutoff).map(([id]) => id) : []);
  }
  const { data } = await sb()
    .from("room_presence")
    .select("player_id, seen_at")
    .eq("code", code)
    .gt("seen_at", new Date(cutoff).toISOString());
  return new Set((data ?? []).map((r) => r.player_id as string));
}
