"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, LETTERS } from "@/lib/client";
import { Wordmark } from "@/components/ui";

type Q = { id: string; set: "honoreeVs" | "knowHer" | "final40"; type: "mc" | "text" | "number"; prompt: string; options: string[]; image?: string };
type State = { authed: boolean; name: string; configured?: boolean; questions?: Q[]; answers?: Record<string, string | number> };

const GROUPS: { set: Q["set"]; title: string; hint: string }[] = [
  { set: "honoreeVs", title: "Them vs. you", hint: "Your friends will try to guess what you picked here. Be honest; it’s more fun." },
  { set: "knowHer", title: "How well do they know you?", hint: "Your real answers. They’ll be checked against what everyone guesses." },
  { set: "final40", title: "For the final round", hint: "A few last facts about your life." },
];

export default function HerPage() {
  const [s, setS] = useState<State | null>(null);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = () => api<State>("/api/her").then(setS).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  async function save(id: string, value: string | number | null) {
    setSaving(id);
    setS((x) => {
      if (!x) return x;
      const answers = { ...(x.answers ?? {}) };
      if (value === null || value === "") delete answers[id];
      else answers[id] = value;
      return { ...x, answers };
    });
    try {
      await api("/api/her", { method: "PUT", body: JSON.stringify({ id, value }) });
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
    setSaving(null);
  }

  if (!s) return <main className="min-h-[100dvh] grid place-items-center label anim-pulse">One moment…</main>;

  if (!s.authed)
    return (
      <main className="min-h-[100dvh] px-6 py-10 max-w-sm mx-auto flex flex-col justify-center">
        <Link href="/">
          <Wordmark className="text-3xl" />
        </Link>
        <p className="label mt-12 mb-3">For the birthday girl only</p>
        <h1 className="display text-5xl">
          Hello, <span className="italic">{s.name}.</span>
        </h1>
        <p className="mt-4 text-bone/60">Answer a few questions before the party. Nobody else sees what you write.</p>
        {s.configured === false ? (
          <p className="mt-10 text-bone/70">The host hasn’t set your password yet. Ask her for it.</p>
        ) : (
          <form
            className="mt-10 space-y-6"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/api/her", { method: "POST", body: JSON.stringify({ password: pw }) });
                load();
              } catch (e) {
                setErr((e as Error).message);
              }
            }}
          >
            <input type="password" className="field" placeholder="Your password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
            {err && <p className="text-rouge text-sm">{err}</p>}
            <button className="btn-acid w-full py-4">Come in</button>
          </form>
        )}
      </main>
    );

  const qs = s.questions ?? [];
  const answers = s.answers ?? {};
  const done = qs.filter((q) => answers[q.id] !== undefined).length;

  return (
    <main className="min-h-[100dvh] px-5 pt-6 pb-24 max-w-xl mx-auto">
      <header className="flex justify-between items-baseline">
        <Wordmark className="text-2xl" />
        <span className="label">
          {done} of {qs.length} answered
        </span>
      </header>
      <h1 className="display text-5xl mt-12 anim-rise">
        Your answers, <span className="italic">in confidence.</span>
      </h1>
      <p className="mt-4 text-bone/60 leading-relaxed anim-rise delay-1">
        Everything saves as you go. Come back and change anything until the party starts. During the game, your friends try to guess these.
      </p>
      {err && <p className="text-rouge text-sm mt-4">{err}</p>}

      {GROUPS.map((g) => {
        const list = qs.filter((q) => q.set === g.set);
        if (!list.length) return null;
        return (
          <section key={g.set} className="mt-14">
            <h2 className="display text-3xl">{g.title}</h2>
            <p className="text-bone/50 text-sm mt-1 mb-6">{g.hint}</p>
            <ol className="space-y-10">
              {list.map((q) => (
                <li key={q.id}>
                  <p className="font-serif text-2xl leading-snug mb-3">{q.prompt}</p>
                  {q.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.image} alt="" className="w-full max-h-64 object-cover mb-3" />
                  )}
                  {q.type === "mc" ? (
                    <div className="space-y-2">
                      {q.options.map((o, i) => {
                        const active = answers[q.id] === i;
                        return (
                          <button
                            key={i}
                            onClick={() => save(q.id, active ? null : i)}
                            className={`w-full text-left flex items-center gap-3 px-4 py-3 border transition ${active ? "bg-acid text-ink border-acid" : "border-bone/20 hover:border-bone/60"}`}
                          >
                            <span className={`font-mono text-xs w-5 ${active ? "text-ink/60" : "text-bone/40"}`}>{LETTERS[i]}</span>
                            {o}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <TextAnswer value={answers[q.id] === undefined ? "" : String(answers[q.id])} onSave={(v) => save(q.id, v)} />
                  )}
                  <p className="label mt-2 h-4">{saving === q.id ? "Saving…" : answers[q.id] !== undefined ? "Saved" : ""}</p>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
      {!qs.length && <p className="mt-12 font-serif italic text-2xl text-bone/50">No questions for you yet. The host is still writing them.</p>}
    </main>
  );
}

function TextAnswer({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      className="field"
      value={v}
      maxLength={140}
      placeholder="Your answer"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() !== value && onSave(v.trim())}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}
