"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useMuted, sfx } from "@/lib/sound";
import { useNow } from "@/hooks/useRoom";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-serif italic tracking-tight ${className}`}>
      Quarante<span className="text-acid not-italic">.</span>
    </span>
  );
}

export function MuteButton({ className = "" }: { className?: string }) {
  const [muted, setMuted] = useMuted();
  return (
    <button
      type="button"
      onClick={() => {
        setMuted(!muted);
        if (muted) setTimeout(() => sfx.tap(), 10);
      }}
      className={`label hover:text-bone transition ${className}`}
      aria-label={muted ? "Unmute" : "Mute"}
    >
      {muted ? "Sound off" : "Sound on"}
    </button>
  );
}

export function QR({ value, size = 220, className = "" }: { value: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(value, { type: "svg", margin: 0, color: { dark: "#16090B", light: "#EEE5D6" }, errorCorrectionLevel: "M" })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [value]);
  return (
    <div className={`bg-bone p-3 ${className}`} style={{ width: size, height: size }}>
      <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}

/** Countdown driven by server time. Fires onExpire once. */
export function Timer({
  deadline,
  total,
  now,
  paused,
  pausedRemaining,
  onExpire,
  ticks = false,
  variant = "bar",
}: {
  deadline: number | null;
  total: number;
  now: () => number;
  paused: boolean;
  pausedRemaining: number | null;
  onExpire?: () => void;
  ticks?: boolean;
  variant?: "bar" | "number";
}) {
  useNow(100);
  const fired = useRef<number | null>(null);
  const lastTick = useRef<number>(-1);
  const remaining = paused ? pausedRemaining ?? 0 : deadline ? Math.max(0, deadline - now()) : 0;
  const secs = Math.ceil(remaining / 1000);
  const frac = total > 0 ? Math.min(1, remaining / (total * 1000)) : 0;

  useEffect(() => {
    if (!deadline || paused) return;
    if (remaining <= 0 && fired.current !== deadline) {
      fired.current = deadline;
      onExpire?.();
    }
    if (ticks && secs <= 5 && secs > 0 && lastTick.current !== secs) {
      lastTick.current = secs;
      sfx.tick();
    }
  });

  if (!deadline && !paused) return null;
  if (variant === "number")
    return (
      <span className={`font-mono tabular-nums ${secs <= 5 ? "text-rouge" : "text-bone"}`}>
        {paused ? "II" : String(secs).padStart(2, "0")}
      </span>
    );
  return (
    <div className="w-full h-[3px] bg-bone/10 overflow-hidden">
      <div
        className={`h-full ${secs <= 5 ? "bg-rouge" : "bg-acid"} transition-[width] duration-100 ease-linear`}
        style={{ width: `${frac * 100}%` }}
      />
    </div>
  );
}

export function TeamDot({ color, className = "" }: { color: string; className?: string }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${className}`} style={{ background: color }} />;
}

export function PromptText({ text, className = "", scale = 1 }: { text: string; className?: string; scale?: number }) {
  const len = text.length;
  const size = len < 40 ? 1 : len < 80 ? 0.82 : len < 140 ? 0.66 : 0.54;
  return (
    <h1 className={`display ${className}`} style={{ fontSize: `calc(${size * scale} * var(--prompt-size, 3rem))` }}>
      {text}
    </h1>
  );
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 anim-rise bg-bone text-ink px-4 py-3 text-sm max-w-[90vw] shadow-2xl">
      {message}
    </div>
  );
}
