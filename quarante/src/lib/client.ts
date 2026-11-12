"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _sb: SupabaseClient | null | undefined;
export function browserSupabase(): SupabaseClient | null {
  if (_sb !== undefined) return _sb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  _sb = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return _sb;
}

export const store = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
  del(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

export type PlayerCreds = { pid: string; secret: string; name: string };
export const playerKey = (code: string) => `q40:player:${code.toUpperCase()}`;
export const hostKey = (code: string) => `q40:host:${code.toUpperCase()}`;

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error ?? `Request failed (${res.status})`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
export const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X"];
export const TEAM_COLORS = ["#A6111F", "#407854", "#CD9618", "#460810"];
export const GOLD = "#E2AE2E";
export const teamColor = (teams: { id: string }[], id: string) => TEAM_COLORS[Math.max(0, teams.findIndex((t) => t.id === id)) % TEAM_COLORS.length];

/** Resize an image file in the browser before upload. */
export async function resizeImage(file: File, max = 1400, quality = 0.82): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Centre-crop a photo to a square and shrink it, for player portraits. */
export async function squarePhoto(file: File, size = 320): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const side = Math.min(img.width, img.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}
