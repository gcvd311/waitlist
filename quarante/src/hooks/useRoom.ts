"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, browserSupabase } from "@/lib/client";
import type { RoomView } from "@/lib/types";

export type RoomAuth = { host: string } | { pid: string; secret: string };

/**
 * Keeps a room view fresh. With Supabase: a Realtime pulse triggers a refetch, plus a slow poll
 * as a safety net. Without: a fast poll. Every response carries server time so timers agree.
 */
export function useRoom(code: string, auth: RoomAuth | null) {
  const [view, setView] = useState<RoomView | null>(null);
  const [error, setError] = useState<{ message: string; status: number } | null>(null);
  const [connected, setConnected] = useState(true);
  const offset = useRef(0);
  const seq = useRef(0);
  const applied = useRef(0);

  const apply = useCallback((v: RoomView, s: number, sentAt: number) => {
    if (s < applied.current) return;
    applied.current = s;
    const rtt = Date.now() - sentAt;
    offset.current = v.serverNow + rtt / 2 - Date.now();
    setView(v);
    setError(null);
    setConnected(true);
  }, []);

  const query = auth ? ("host" in auth ? `h=${encodeURIComponent(auth.host)}` : `pid=${auth.pid}&s=${auth.secret}`) : "";

  const refresh = useCallback(async () => {
    if (!auth) return;
    const s = ++seq.current;
    const sentAt = Date.now();
    try {
      const v = await api<RoomView>(`/api/rooms/${code}?${query}`);
      apply(v, s, sentAt);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status) setError({ message: err.message, status: err.status });
      else setConnected(false);
    }
  }, [code, query, auth, apply]);

  useEffect(() => {
    if (!auth) return;
    refresh();
    const sb = browserSupabase();
    const iv = setInterval(refresh, sb ? 3500 : 1000);
    const channel = sb
      ?.channel(`pulse-${code}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_pulse", filter: `code=eq.${code.toUpperCase()}` }, () => refresh())
      .subscribe();
    const wake = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    return () => {
      clearInterval(iv);
      if (channel) sb?.removeChannel(channel);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
    };
  }, [auth, code, refresh]);

  const act = useCallback(
    async (action: Record<string, unknown>): Promise<{ ok: boolean; message?: string }> => {
      if (!auth) return { ok: false };
      const s = ++seq.current;
      const sentAt = Date.now();
      try {
        const res = await api<{ view: RoomView; message?: string }>(`/api/rooms/${code}/action`, {
          method: "POST",
          body: JSON.stringify({ auth, action }),
        });
        apply(res.view, s, sentAt);
        return { ok: true, message: res.message };
      } catch (e) {
        const err = e as Error & { status?: number };
        if (err.status === 409) refresh();
        return { ok: false, message: err.message };
      }
    },
    [auth, code, apply, refresh],
  );

  const now = useCallback(() => Date.now() + offset.current, []);
  return { view, error, connected, act, refresh, now };
}

export function useNow(interval = 200) {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => set((x) => x + 1), interval);
    return () => clearInterval(iv);
  }, [interval]);
}
