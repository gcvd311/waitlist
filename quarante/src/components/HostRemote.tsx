"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import type { RoomView } from "@/lib/types";

/** A compact control strip for a host who is also playing on her phone. */
export default function HostRemote({ code, hostToken, view }: { code: string; hostToken: string; view: RoomView }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const send = async (action: Record<string, unknown>) => {
    setMsg(null);
    try {
      await api(`/api/rooms/${code}/action`, { method: "POST", body: JSON.stringify({ auth: { host: hostToken }, action }) });
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const nextLabel = { lobby: "Start", round_intro: "Begin", wager: "Lock wagers", question: "Reveal", reveal: "Next", leaderboard: "Next round", final: "" }[view.phase];
  return (
    <div className="fixed bottom-0 inset-x-0 z-30 bg-wine/95 backdrop-blur border-t border-bone/10">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-2">
        <span className="label mr-auto">Host</span>
        {open && (
          <>
            <button className="btn-ghost btn-sm" onClick={() => send({ type: view.paused ? "resume" : "pause" })}>
              {view.paused ? "Resume" : "Pause"}
            </button>
            <button className="btn-ghost btn-sm" onClick={() => send({ type: "skip" })}>
              Skip
            </button>
          </>
        )}
        <button className="btn-ghost btn-sm" onClick={() => setOpen(!open)}>
          {open ? "Less" : "More"}
        </button>
        {nextLabel && (
          <button className="btn-acid btn-sm" onClick={() => send({ type: view.phase === "lobby" ? "start" : "next" })}>
            {nextLabel}
          </button>
        )}
      </div>
      {msg && <p className="text-rouge text-xs text-center pb-2">{msg}</p>}
    </div>
  );
}
