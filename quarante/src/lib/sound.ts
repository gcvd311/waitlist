"use client";
import { useEffect, useState } from "react";

// All sound is synthesised: no assets, nothing to license. Soft, short, low.
let ctx: AudioContext | null = null;
let muted = false;
const listeners = new Set<(m: boolean) => void>();

if (typeof window !== "undefined") {
  try {
    muted = localStorage.getItem("q40:muted") === "1";
  } catch {}
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, start: number, dur: number, gain = 0.08, type: OscillatorType = "sine") {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  unlock: () => ac(),
  tick: () => tone(1320, 0, 0.05, 0.03, "triangle"),
  tap: () => tone(660, 0, 0.08, 0.05, "triangle"),
  lock: () => (tone(523.25, 0, 0.12, 0.06), tone(784, 0.07, 0.18, 0.05)),
  reveal: () => (tone(392, 0, 0.5, 0.05), tone(493.88, 0.04, 0.5, 0.04), tone(587.33, 0.08, 0.6, 0.04)),
  right: () => (tone(659.25, 0, 0.16, 0.06), tone(987.77, 0.1, 0.3, 0.05)),
  wrong: () => (tone(220, 0, 0.22, 0.06, "triangle"), tone(207.65, 0.12, 0.3, 0.05, "triangle")),
  round: () => [261.63, 329.63, 392, 523.25].forEach((f, i) => tone(f, i * 0.09, 0.7, 0.035)),
  finale: () =>
    [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, i * 0.14, 1.1, 0.035)),
};

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem("q40:muted", m ? "1" : "0");
  } catch {}
  listeners.forEach((l) => l(m));
}

export function useMuted(): [boolean, (m: boolean) => void] {
  const [m, setM] = useState(false);
  useEffect(() => {
    setM(muted);
    listeners.add(setM);
    return () => void listeners.delete(setM);
  }, []);
  return [m, setMuted];
}
