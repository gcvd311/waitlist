"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, LETTERS, ROMAN, store, teamColor } from "@/lib/client";
import { buildRound, createRoomState, fillName } from "@/lib/engine";
import { Mascot, MuteButton, Portrait, Sticker, TeamDot, TitleLockup, Wordmark } from "@/components/ui";
import { Standings } from "@/components/game";
import { sfx } from "@/lib/sound";
import type { Content, RoomQuestion, RoomRound } from "@/lib/types";

// Pass & play: one phone, no network after load. The host reads aloud, teams answer
// out loud, the host taps who got it. Same content and round structure as the live game.

type Solo = {
  content: Content;
  rounds: RoomRound[];
  r: number;
  q: number;
  phase: "intro" | "wager" | "question" | "reveal" | "unmask" | "board" | "final";
  unmask?: number;
  scores: Record<string, number>;
  wagers: Record<string, number>;
  awarded: Record<string, number>; // teamId -> points given on this question
  endsAt: number | null;
  pausedLeft: number | null;
};

const KEY = "q40:solo";

function start(content: Content): Solo {
  const state = createRoomState("SOLO", content, Date.now());
  const rounds = state.rounds.map((round, i) => ({ ...round, questions: buildRound(state, i) }));
  return {
    content,
    rounds,
    r: 0,
    q: 0,
    phase: "intro",
    scores: Object.fromEntries(content.teams.map((t) => [t.id, 0])),
    wagers: {},
    awarded: {},
    endsAt: null,
    pausedLeft: null,
  };
}

export default function SoloPage() {
  const [s, setS] = useState<Solo | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const saved = store.get<Solo>(KEY);
    if (saved?.rounds) setS(saved);
  }, []);
  useEffect(() => {
    if (s) store.set(KEY, s);
  }, [s]);
  useEffect(() => {
    const iv = setInterval(() => tick((x) => x + 1), 250);
    return () => clearInterval(iv);
  }, []);

  async function begin() {
    sfx.unlock();
    try {
      const { content } = await api<{ content: Content }>("/api/content");
      setS(start(content));
      sfx.round();
    } catch {
      setNeedsLogin(true);
    }
  }

  if (!s)
    return (
      <main className="min-h-[100dvh] px-6 py-8 max-w-md mx-auto flex flex-col">
        <Link href="/">
          <Wordmark className="text-2xl" />
        </Link>
        <div className="flex-1 flex flex-col justify-center items-center text-center">
          <Mascot pose="peek" className="w-44 -mb-4" />
          <TitleLockup size="clamp(3.4rem, 18vw, 5.4rem)" />
          <p className="font-serif italic font-bold text-2xl mt-6">{"Crystal turns 40. We have questions."}</p>
          <p className="mt-5 text-bone/70 leading-relaxed text-sm">
            One phone, read aloud. For when the Wi-Fi is hopeless. The host reads each question aloud, teams confer and answer out loud, and the host taps who got it right.
          </p>
          {needsLogin && (
            <p className="text-rouge text-sm mt-6">
              Sign in to the <Link href="/admin" className="underline">admin</Link> first; this mode loads your questions and answers.
            </p>
          )}
          <button className="btn-acid w-full py-5 mt-10 text-lg" onClick={begin}>
            Start
          </button>
        </div>
      </main>
    );

  const round = s.rounds[s.r];
  const q: RoomQuestion | undefined = round?.questions[s.q];
  const name = s.content.honoree.name;
  const teams = s.content.teams.map((t) => ({ id: t.id, name: t.name, score: s.scores[t.id] ?? 0, wager: null, maxWager: 0 }));
  const set = (patch: Partial<Solo>) => setS({ ...s, ...patch });

  const left = s.pausedLeft ?? (s.endsAt ? Math.max(0, s.endsAt - Date.now()) : 0);
  const startQ = (patch: Partial<Solo> = {}) =>
    set({ phase: "question", awarded: {}, endsAt: q && q.timerSec ? Date.now() + q.timerSec * 1000 : null, pausedLeft: null, ...patch });

  function next() {
    sfx.tap();
    if (s!.phase === "intro") {
      if (!round.questions.length) return nextRound();
      if (round.kind === "final40") return set({ phase: "wager", wagers: {} });
      return startQ();
    }
    if (s!.phase === "wager") return startQ();
    if (s!.phase === "question") return set({ phase: "reveal", endsAt: null, pausedLeft: null }), sfx.reveal();
    if (s!.phase === "reveal") {
      if (s!.q + 1 < round.questions.length) {
        const nq = round.questions[s!.q + 1];
        if (round.kind === "final40") return set({ q: s!.q + 1, phase: "wager", wagers: {}, awarded: {} });
        return setS({ ...s!, q: s!.q + 1, phase: "question", awarded: {}, endsAt: nq.timerSec ? Date.now() + nq.timerSec * 1000 : null, pausedLeft: null });
      }
      return set({ phase: "board" });
    }
    if (s!.phase === "unmask") {
      const n = s!.content.players.length;
      if ((s!.unmask ?? 0) <= n) return set({ unmask: (s!.unmask ?? 0) + 1 });
      return set({ phase: "board" });
    }
    if (s!.phase === "board") return nextRound();
  }
  function nextRound() {
    if (s!.r + 1 < s!.rounds.length) set({ r: s!.r + 1, q: 0, phase: "intro" }), sfx.round();
    else set({ phase: "final" }), sfx.finale();
  }
  function toggleAward(teamId: string, pts: number) {
    const cur = s!.awarded[teamId] ?? 0;
    const nextPts = cur === pts ? 0 : pts;
    setS({ ...s!, awarded: { ...s!.awarded, [teamId]: nextPts }, scores: { ...s!.scores, [teamId]: (s!.scores[teamId] ?? 0) - cur + nextPts } });
    if (nextPts > 0) sfx.right();
    else if (nextPts < 0) sfx.wrong();
  }

  return (
    <main className="min-h-[100dvh] px-5 pt-5 pb-8 max-w-md mx-auto flex flex-col">
      <header className="flex items-center justify-between mb-6">
        <div className="flex gap-4">
          {teams.map((t) => (
            <span key={t.id} className="flex items-center gap-2 text-sm">
              <TeamDot color={teamColor(teams, t.id)} />
              <span className="font-mono tabular-nums">{t.score}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <MuteButton />
          <button className="label hover:text-rouge" onClick={() => confirm("End this game?") && (store.del(KEY), setS(null))}>
            End
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col" key={`${s.phase}${s.r}.${s.q}`}>
        {s.phase === "intro" && (
          <div className="flex-1 flex flex-col justify-center items-center text-center">
            <Mascot pose="peek" className="w-40 -mb-2 anim-rise" />
            <p className="font-mono font-semibold uppercase tracking-label text-xl anim-rise">
              Round {s.r + 1} / {s.rounds.length}
            </p>
            <h1 className="title-face text-5xl -rotate-[3deg] mt-3 anim-rise delay-1">{fillName(round.title, name)}</h1>
            <p className="font-serif italic text-2xl text-bone/60 mt-4 anim-rise delay-2">{fillName(round.subtitle, name)}</p>
            {round.kind === "mostLikely" && <p className="mt-8 text-bone/60">Read it out, count to three, everyone points. No points, only consequences.</p>}
            {round.kind === "honoreeVs" && <p className="mt-8 text-bone/60">She writes her answer down first. Teams then guess aloud.</p>}
            {round.kind === "whoSaid" && !round.questions.length && <p className="mt-8 text-bone/60">No confessions collected yet. Skip ahead.</p>}
          </div>
        )}

        {s.phase === "wager" && q && (
          <div className="flex-1 flex flex-col justify-center gap-8">
            <h1 className="display text-5xl">Wagers.</h1>
            {q.category && <p className="font-serif italic text-2xl text-bone/60">Subject: {q.category}</p>}
            {teams.map((t) => (
              <div key={t.id}>
                <p className="flex items-center gap-2 mb-2">
                  <TeamDot color={teamColor(teams, t.id)} /> {t.name} <span className="text-bone/40 text-sm">holding {t.score}</span>
                </p>
                <div className="flex items-center gap-3">
                  <button className="btn-ghost btn-sm" onClick={() => set({ wagers: { ...s.wagers, [t.id]: Math.max(0, (s.wagers[t.id] ?? 0) - 50) } })}>
                    −50
                  </button>
                  <span className="font-mono text-4xl tabular-nums w-24 text-center">{s.wagers[t.id] ?? 0}</span>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => set({ wagers: { ...s.wagers, [t.id]: Math.min(Math.max(t.score, s.content.scoring.wagerFloor), (s.wagers[t.id] ?? 0) + 50) } })}
                  >
                    +50
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(s.phase === "question" || s.phase === "reveal") && q && (
          <div className="card relative flex-1 flex flex-col px-5 py-6">
            <Sticker name="bow" className="absolute -top-4 -right-2 w-14 rotate-12" />
            <div className="flex justify-between label mb-2">
              <span>
                {s.q + 1}/{round.questions.length}
                {q.category ? ` · ${q.category}` : ""}
              </span>
              {s.phase === "question" && (s.endsAt || s.pausedLeft !== null) && (
                <button
                  className={`font-mono text-lg ${left < 5000 ? "text-rouge" : "text-bone"}`}
                  onClick={() => (s.pausedLeft !== null ? set({ endsAt: Date.now() + s.pausedLeft, pausedLeft: null }) : set({ pausedLeft: left, endsAt: null }))}
                >
                  {s.pausedLeft !== null ? "Resume" : Math.ceil(left / 1000)}
                </button>
              )}
            </div>
            {q.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={q.image} alt="" className="w-full max-h-56 object-cover mb-4" />
            )}
            <h1 className={`display ${q.prompt.length > 90 ? "text-3xl" : "text-4xl"} ${q.kind === "whoSaid" ? "italic" : ""}`}>
              {q.kind === "whoSaid" ? `“${q.prompt}”` : q.prompt}
            </h1>
            {q.kind === "men" && (
              <div className={`mt-6 grid gap-2 ${q.options.length <= 3 ? "grid-cols-3" : "grid-cols-3"}`}>
                {q.options.map((o, i) => (
                  <div key={i}>
                    <Portrait photo={q.optionPhotos?.[i]} name={o} />
                    <p className="font-serif text-lg mt-1">{o}</p>
                  </div>
                ))}
              </div>
            )}
            {q.type === "mc" && q.kind !== "whoSaid" && (
              <ol className="mt-6 space-y-2">
                {q.options.map((o, i) => (
                  <li key={i} className={`flex gap-3 py-2 border-t border-bone/10 ${s.phase === "reveal" && i === q.answer ? "text-acid" : s.phase === "reveal" && typeof q.answer === "number" ? "text-bone/35" : ""}`}>
                    <span className="font-mono text-xs text-bone/40 pt-1">{LETTERS[i]}</span>
                    {o}
                  </li>
                ))}
              </ol>
            )}

            {s.phase === "reveal" && (
              <div className="mt-8 anim-rise">
                <p className="label mb-2">Answer</p>
                <p className="display text-4xl">
                  {q.kind === "men"
                    ? q.type === "kfm"
                      ? "Everyone, one at a time: kill, fuck, marry."
                      : "Hands up on three."
                    : q.kind === "mostLikely"
                    ? "Point on three."
                    : q.kind === "honoreeVs"
                      ? typeof q.answer === "number" ? q.options[q.answer] : "Ask her."
                      : q.type === "mc"
                        ? q.options[q.answer as number] ?? "Not entered yet"
                        : String(q.answer || "Not entered yet")}
                </p>
                {q.note && <p className="font-serif italic text-xl text-bone/55 mt-2">{q.note}</p>}

                {q.kind !== "mostLikely" && q.kind !== "men" && (
                  <div className="mt-8 space-y-3">
                    <p className="label">{round.kind === "final40" ? "Who was right?" : "Who gets it?"}</p>
                    {teams.map((t) => {
                      const w = s.wagers[t.id] ?? 0;
                      const aw = s.awarded[t.id] ?? 0;
                      return (
                        <div key={t.id} className="flex items-center gap-2">
                          <TeamDot color={teamColor(teams, t.id)} />
                          <span className="flex-1">{t.name}</span>
                          {round.kind === "final40" ? (
                            <>
                              <button className={`btn-sm border ${aw > 0 ? "border-acid text-acid" : "border-bone/20"}`} onClick={() => toggleAward(t.id, w)}>
                                Right +{w}
                              </button>
                              <button className={`btn-sm border ${aw < 0 ? "border-rouge text-rouge" : "border-bone/20"}`} onClick={() => toggleAward(t.id, -w)}>
                                Wrong −{w}
                              </button>
                            </>
                          ) : (
                            <button className={`btn-sm border ${aw > 0 ? "border-acid text-acid" : "border-bone/20"}`} onClick={() => toggleAward(t.id, q.points)}>
                              +{q.points}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {s.phase === "unmask" && (() => {
          const ps = s.content.players;
          const k = s.unmask ?? 0;
          const p = k >= 1 && k <= ps.length ? ps[k - 1] : null;
          if (k === 0)
            return (
              <div className="flex-1 flex flex-col justify-center">
                <p className="label mb-3">The unmasking</p>
                <h1 className="display text-5xl">
                  Who were these men, <span className="italic text-acid">really?</span>
                </h1>
              </div>
            );
          if (p)
            return (
              <div className="flex-1 flex flex-col justify-center gap-4" key={p.id}>
                <div className="grid grid-cols-2 gap-3">
                  <Portrait photo={p.malePhotos[0]} name={p.maleName} className="anim-rise" />
                  <Portrait photo={p.photo} name={p.name} className="anim-unveil" />
                </div>
                <h1 className="display text-5xl">
                  {p.maleName} <span className="italic text-bone/50">is</span> <span className="text-acid anim-unveil inline-block">{p.name}</span>
                </h1>
              </div>
            );
          return (
            <div className="flex-1 grid grid-cols-2 gap-4 content-center">
              {ps.map((x) => (
                <div key={x.id}>
                  <div className="grid grid-cols-2 gap-1">
                    <Portrait photo={x.malePhotos[0]} name={x.maleName} />
                    <Portrait photo={x.photo} name={x.name} />
                  </div>
                  <p className="text-sm mt-1">
                    {x.maleName} <span className="text-bone/40">is</span> <span className="text-acid">{x.name}</span>
                  </p>
                </div>
              ))}
            </div>
          );
        })()}

        {s.phase === "board" && (
          <div className="flex-1 flex flex-col justify-center gap-8">
            <p className="label">After round {ROMAN[s.r]}</p>
            <Standings teams={teams} />
          </div>
        )}

        {s.phase === "final" && (
          <div className="flex-1 flex flex-col justify-center gap-8">
            <TitleLockup size="clamp(3rem, 15vw, 5rem)" />
            <p className="font-serif italic font-bold text-3xl flex items-center gap-3 justify-center">
              Happy birthday, {name}. <Sticker name="double-hearts" className="w-12" />
            </p>
            <Sticker name="cat-smile" className="w-40 mx-auto" />
            <Standings teams={teams} />
            {s.content.messages.map((m) => (
              <blockquote key={m.id} className="border-t border-bone/10 pt-4">
                <p className="font-serif text-xl">“{m.text}”</p>
                <footer className="label mt-2">{m.from}</footer>
              </blockquote>
            ))}
          </div>
        )}
      </div>

      {s.phase !== "final" && (
        <button className="btn-acid w-full py-5 mt-8 text-lg" onClick={next}>
          {s.phase === "question" ? "Reveal" : s.phase === "wager" ? "Show the question" : s.phase === "board" ? "Next round" : s.phase === "unmask" ? "Unmask" : "Next"}
        </button>
      )}
    </main>
  );
}
