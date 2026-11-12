"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Wordmark } from "@/components/ui";

export default function Confess() {
  const [her, setHer] = useState("her");
  const [name, setName] = useState("");
  const [c, setC] = useState(["", "", ""]);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ name: string }>("/api/confess").then((r) => setHer(r.name)).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    try {
      await api("/api/confess", { method: "POST", body: JSON.stringify({ name, confessions: c, message }) });
      setState("done");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  }

  if (state === "done")
    return (
      <main className="min-h-[100dvh] px-6 py-10 max-w-md mx-auto flex flex-col justify-center">
        <p className="label mb-4">Received</p>
        <h1 className="display text-6xl anim-rise">
          Sealed. <span className="italic">Until the party.</span>
        </h1>
        <p className="mt-6 text-bone/60">Nobody sees your name until the reveal. Not even {her}.</p>
      </main>
    );

  return (
    <main className="min-h-[100dvh] px-6 pt-8 pb-16 max-w-md mx-auto">
      <Wordmark className="text-2xl" />
      <h1 className="display text-5xl mt-12 anim-rise">
        Before the party, <span className="italic">a few confessions.</span>
      </h1>
      <p className="mt-5 text-bone/60 leading-relaxed anim-rise delay-1">
        Opinions, stories, small crimes. During the game everyone will guess who wrote each one. Keep them short. Make them
        yours.
      </p>
      <form onSubmit={submit} className="mt-10 space-y-8">
        <div>
          <label className="label block mb-1">Your name</label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="The name you’ll play under" />
        </div>
        {c.map((v, i) => (
          <div key={i}>
            <label className="label block mb-1">Confession {i + 1}</label>
            <textarea
              className="box min-h-[84px]"
              maxLength={280}
              value={v}
              onChange={(e) => setC(c.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={["I have never once read the terms and conditions, and I never will.", "", ""][i]}
            />
          </div>
        ))}
        <div>
          <label className="label block mb-1">A message for {her}</label>
          <textarea
            className="box min-h-[120px]"
            maxLength={600}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Shown on the final screen."
          />
        </div>
        {error && <p className="text-rouge text-sm">{error}</p>}
        <button className="btn-acid w-full py-5" disabled={state === "busy"}>
          {state === "busy" ? "Sending…" : "Seal it"}
        </button>
      </form>
    </main>
  );
}
