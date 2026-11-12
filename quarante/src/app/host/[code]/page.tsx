"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { hostKey, LETTERS, ROMAN, store, teamColor } from "@/lib/client";
import { useRoom } from "@/hooks/useRoom";
import { sfx } from "@/lib/sound";
import { Avatar, MuteButton, Portrait, PromptText, QR, TeamDot, Timer, TitleLockup, Toast, Wordmark } from "@/components/ui";
import { Bars, KfmTable, Lineup, Ranking, screenGrid, revealHeadline, RevealResultList, Standings, TopPlayers, voteRows } from "@/components/game";
import type { RoomView } from "@/lib/types";

type Act = ReturnType<typeof useRoom>["act"];

export default function HostPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    // A host link can carry the token in the hash so the TV can be opened from another device.
    const m = /t=([a-z0-9]+)/i.exec(window.location.hash);
    if (m) {
      store.set(hostKey(code), m[1]);
      history.replaceState(null, "", window.location.pathname);
    }
    setToken(store.get<string>(hostKey(code)));
  }, [code]);

  const auth = useMemo(() => (token ? { host: token } : null), [token]);
  const { view, error, act, now, connected } = useRoom(code, auth);
  const [toast, setToast] = useState<string | null>(null);
  const [dock, setDock] = useState(true);
  const clearToast = useCallback(() => setToast(null), []);

  const run = useCallback(
    async (action: Record<string, unknown>) => {
      sfx.unlock();
      const r = await act(action);
      if (!r.ok && r.message) setToast(r.message);
    },
    [act],
  );

  useHostAutomation(view, run, false);
  useHostSounds(view);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      if (!view) return;
      if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        run({ type: view.phase === "lobby" ? "start" : "next" });
      } else if (e.key === "p") run({ type: view.paused ? "resume" : "pause" });
      else if (e.key === "h") setDock((d) => !d);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, run]);

  if (token === null)
    return (
      <main className="min-h-[100dvh] grid place-items-center px-6 text-center">
        <div>
          <h1 className="display text-5xl">This screen isn’t the host.</h1>
          <p className="mt-4 text-bone/60">Start a game from the admin, or open the host link on this device.</p>
          <Link href="/admin" className="btn-ghost mt-8">
            Go to admin
          </Link>
        </div>
      </main>
    );
  if (error && (error.status === 401 || error.status === 404))
    return (
      <main className="min-h-[100dvh] grid place-items-center px-6 text-center">
        <div>
          <h1 className="display text-5xl">{error.message}</h1>
          <Link href="/admin" className="btn-ghost mt-8">
            Back to admin
          </Link>
        </div>
      </main>
    );
  if (!view) return <main className="min-h-[100dvh] grid place-items-center label anim-pulse">Setting the table…</main>;

  return (
    <main className="min-h-[100dvh] flex flex-col [--prompt-size:clamp(2.6rem,6.2vw,7.5rem)]" onClick={() => sfx.unlock()}>
      <header className="flex items-center justify-between px-6 lg:px-12 pt-5">
        <Wordmark className="text-2xl" />
        <span className="label hidden sm:block">
          {view.round && view.phase !== "lobby" && view.phase !== "final"
            ? `Round ${ROMAN[view.round.index]} · ${view.round.title}`
            : `For ${view.honoree.name}`}
        </span>
        <div className="flex items-center gap-5">
          {!connected && <span className="label text-rouge anim-pulse">Offline</span>}
          <span className="font-mono tracking-[0.25em] text-bone/70">{view.code}</span>
          <MuteButton />
        </div>
      </header>

      <section className="flex-1 flex flex-col px-6 lg:px-12 py-6" key={`${view.phase}-${view.question?.key ?? view.round?.index ?? ""}`}>
        <Stage view={view} run={run} now={now} />
      </section>

      {view.paused && (
        <div className="fixed inset-0 z-30 bg-ink/85 backdrop-blur-sm grid place-items-center anim-fade pointer-events-none">
          <p className="display text-[10vw] italic">Paused.</p>
        </div>
      )}

      {dock ? <Dock view={view} run={run} hide={() => setDock(false)} /> : (
        <button className="fixed bottom-3 right-3 label z-40 opacity-40 hover:opacity-100" onClick={() => setDock(true)}>
          Controls
        </button>
      )}
      <Toast message={toast} onDone={clearToast} />
    </main>
  );
}

/** Reveal when the clock runs out, or a beat after the last online player answers. */
function useHostAutomation(view: RoomView | null, run: (a: Record<string, unknown>) => void, autoReveal = false) {
  const pending = useRef<string | null>(null);
  useEffect(() => {
    if (!view || view.phase !== "question" || view.paused || !view.question) return;
    if (!autoReveal || view.question.kind === "men") return; // the host closes it
    const onlineEligible = view.players.filter((p) => p.online && view.eligibleIds.includes(p.id));
    const herPending = view.question.kind === "honoreeVs" && view.players.some((p) => p.isHonoree && p.online) && !view.honoreeAnswered;
    const allIn = onlineEligible.length > 0 && onlineEligible.every((p) => view.answeredIds.includes(p.id)) && !herPending;
    if (allIn && pending.current !== view.question.key) {
      pending.current = view.question.key;
      const t = setTimeout(() => run({ type: "reveal" }), 1200);
      return () => clearTimeout(t);
    }
  }, [view, run]);
}

function useHostSounds(view: RoomView | null) {
  const last = useRef("");
  useEffect(() => {
    if (!view) return;
    const sig = `${view.phase}:${view.question?.key ?? ""}:${view.round?.index ?? ""}`;
    if (sig === last.current) return;
    const first = !last.current;
    last.current = sig;
    if (first) return;
    if (view.phase === "round_intro") sfx.round();
    else if (view.phase === "reveal") sfx.reveal();
    else if (view.phase === "final") sfx.finale();
    else if (view.phase === "question") sfx.tap();
  }, [view]);
}

function Stage({ view, run, now }: { view: RoomView; run: Act | ((a: Record<string, unknown>) => void); now: () => number }) {
  switch (view.phase) {
    case "lobby":
      return <Lobby view={view} run={run} />;
    case "round_intro":
      return <RoundIntro view={view} />;
    case "wager":
      return <WagerStage view={view} />;
    case "question":
      return <QuestionStage view={view} now={now} run={run} />;
    case "reveal":
      return <RevealStage view={view} run={run} />;
    case "unmask":
      return <UnmaskStage view={view} />;
    case "leaderboard":
      return <LeaderboardStage view={view} />;
    case "final":
      return <FinalStage view={view} run={run} />;
  }
}

function Lobby({ view, run }: { view: RoomView; run: (a: Record<string, unknown>) => void }) {
  const [origin, setOrigin] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const joinUrl = `${origin}/join/${view.code}`;
  return (
    <div className="flex-1 grid lg:grid-cols-[1fr_1.15fr] gap-12 items-center">
      <div>
        <TitleLockup className="anim-rise mb-10" size="clamp(3.2rem, 6.4vw, 6.8rem)" />
        <p className="label mb-5 anim-rise">Scan, or go to {origin.replace(/^https?:\/\//, "")}/join</p>
        <div className="flex items-end gap-8 flex-wrap">
          {origin && <QR value={joinUrl} size={210} className="anim-rise delay-1" />}
          <div className="anim-rise delay-2">
            <p className="label mb-1">Room</p>
            <p className="font-mono text-[clamp(4rem,10vw,9rem)] leading-none tracking-[0.12em]">{view.code}</p>
          </div>
        </div>
        <p className="mt-10 text-bone/50 anim-rise delay-4">
          {view.confessionCount} confession{view.confessionCount === 1 ? "" : "s"} in the vault. Players can add more from their phones while you wait.
        </p>
      </div>

      {view.profiles.length > 0 && (
        <div>
          <div className="flex justify-between items-baseline mb-4">
            <p className="label">Tap your photo on your phone</p>
            <p className="label">
              {view.profiles.filter((p) => p.playerId).length} / {view.profiles.length} ready
            </p>
          </div>
          <div className={`grid gap-4 ${view.profiles.length > 6 ? "grid-cols-4 xl:grid-cols-5" : "grid-cols-3"}`}>
            {view.profiles.map((pr, i) => {
              const taken = !!pr.playerId;
              return (
                <div key={pr.id} className="relative anim-rise" style={{ animationDelay: `${i * 70}ms` }}>
                  <button className="block w-full text-left" onClick={() => taken && setMenu(menu === pr.id ? null : pr.id)}>
                    <Portrait photo={pr.photo} name={pr.name} dim={!taken}>
                      <span
                        className={`absolute left-2 bottom-2 font-mono text-[11px] tracking-label px-2 py-1 transition ${
                          taken ? "bg-acid text-ink" : "bg-ink/70 text-bone/60 anim-pulse"
                        }`}
                      >
                        {taken ? (pr.online ? "READY" : "AWAY") : "WAITING"}
                      </span>
                      {pr.honoree && <span className="absolute right-2 top-2 label text-acid bg-ink/70 px-1.5 py-0.5">Birthday</span>}
                    </Portrait>
                    <p className={`mt-2 text-xl font-serif ${taken ? "" : "text-bone/40"}`}>{pr.name}</p>
                  </button>
                  {menu === pr.id && pr.playerId && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-wine border border-bone/15 p-2 flex flex-col gap-1.5 anim-fade">
                      <button className="btn-ghost btn-sm" onClick={() => (run({ type: "release", playerId: pr.playerId }), setMenu(null))}>
                        Unlock portrait
                      </button>
                      <button
                        className="btn-ghost btn-sm text-rouge"
                        onClick={() => confirm(`Remove ${pr.name} from the game?`) && (run({ type: "kick", playerId: pr.playerId }), setMenu(null))}
                      >
                        Remove player
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {view.players.some((p) => !p.profileId) && (
            <p className="mt-6 text-bone/50 text-sm">
              Still choosing a photo: {view.players.filter((p) => !p.profileId).map((p) => p.name).join(", ")}
            </p>
          )}
        </div>
      )}

      {(view.profiles.length === 0 || view.teamsEnabled) && <div className="grid sm:grid-cols-2 gap-8 self-stretch content-center">
        {view.teams.filter((t) => view.teamsEnabled || t.id === view.teams[0]?.id).map((t) => {
          const members = view.players.filter((p) => p.team === t.id);
          return (
            <div key={t.id}>
              <div className="flex items-center gap-2.5 mb-4">
                <TeamDot color={teamColor(view.teams, t.id)} className="w-2.5 h-2.5" />
                <h2 className="display text-4xl">{t.name}</h2>
              </div>
              <ul className="space-y-1">
                {members.map((p) => (
                  <li key={p.id} className="relative anim-rise">
                    <button className="w-full text-left flex items-center justify-between py-2 border-b border-bone/10 hover:border-bone/40" onClick={() => setMenu(menu === p.id ? null : p.id)}>
                      <span className={`text-xl flex items-center gap-3 ${p.online ? "" : "text-bone/35"}`}>
                        <Avatar photo={p.photo} name={p.name} size={34} />
                        {p.name}
                        {p.isHonoree && <span className="label text-acid ml-3">Birthday</span>}
                      </span>
                      <span className={`w-1.5 h-1.5 rounded-full ${p.online ? "bg-acid" : "bg-bone/20"}`} />
                    </button>
                    {menu === p.id && (
                      <div className="flex flex-wrap gap-2 py-2 anim-fade">
                        {view.teams.filter((x) => x.id !== t.id).map((x) => (
                          <button key={x.id} className="btn-ghost btn-sm" onClick={() => (run({ type: "setTeam", playerId: p.id, team: x.id }), setMenu(null))}>
                            Move to {x.name}
                          </button>
                        ))}
                        <button className="btn-ghost btn-sm" onClick={() => (run({ type: "setHonoree", playerId: p.isHonoree ? null : p.id }), setMenu(null))}>
                          {p.isHonoree ? "Not the birthday girl" : "She’s the birthday girl"}
                        </button>
                        <button className="btn-ghost btn-sm text-rouge" onClick={() => confirm(`Remove ${p.name}?`) && (run({ type: "kick", playerId: p.id }), setMenu(null))}>
                          Remove
                        </button>
                      </div>
                    )}
                  </li>
                ))}
                {!members.length && <li className="text-bone/30 italic font-serif text-xl py-2">Empty chairs.</li>}
              </ul>
            </div>
          );
        })}
      </div>}
    </div>
  );
}

function RoundIntro({ view }: { view: RoomView }) {
  const r = view.round!;
  const photo = view.honoree.photos.length ? view.honoree.photos[r.index % view.honoree.photos.length] : null;
  const showPhoto = photo && ["knowHer", "honoreeVs", "final40"].includes(r.kind);
  return (
    <div className="flex-1 grid lg:grid-cols-[1fr_auto] gap-12 items-center">
      <div>
        <p className="font-serif italic text-acid text-[clamp(5rem,14vw,14rem)] leading-none anim-rise">{ROMAN[r.index]}</p>
        <h1 className="display text-[clamp(3rem,7.5vw,8rem)] mt-4 anim-rise delay-1">{r.title}</h1>
        <p className="font-serif italic text-[clamp(1.4rem,2.6vw,2.6rem)] text-bone/60 mt-6 max-w-3xl anim-rise delay-2">{r.subtitle}</p>
        <p className="label mt-12 anim-rise delay-4">
          {r.qCount} question{r.qCount === 1 ? "" : "s"}
          {r.kind === "final40" && " · teams wager before each"}
          {r.kind === "mostLikely" && " · votes are anonymous"}
          {r.kind === "honoreeVs" && " · she answers on her phone"}
          {r.qCount === 0 && " · nothing to play, press next"}
        </p>
      </div>
      {showPhoto && (
        <div className="hidden lg:block w-[28vw] max-w-md aspect-[3/4] overflow-hidden anim-fade delay-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="w-full h-full object-cover anim-drift grayscale-[25%]" />
        </div>
      )}
    </div>
  );
}

function WagerStage({ view }: { view: RoomView }) {
  const q = view.question!;
  return (
    <div className="flex-1 flex flex-col justify-center">
      <p className="label mb-4">
        The Final 40 · {view.round!.qIndex + 1} of {view.round!.qCount}
      </p>
      <h1 className="display text-[clamp(3rem,7vw,7rem)]">
        Place your wagers<span className="text-acid">.</span>
      </h1>
      <p className="font-serif italic text-3xl text-bone/60 mt-4">
        {q.category ? `The subject: ${q.category}.` : "The subject is a secret."} {q.aboutHer && `${view.honoree.name} sits this one out.`}
      </p>
      <div className="grid sm:grid-cols-2 gap-10 mt-16">
        {view.teams.map((t) => (
          <div key={t.id} className="border-t-2 pt-5" style={{ borderColor: teamColor(view.teams, t.id) }}>
            <p className="display text-4xl">{t.name}</p>
            <p className="label mt-2">Holding {t.score}</p>
            <p className="font-mono text-7xl tabular-nums mt-6">{t.wager ?? 0}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnswerTally({ view }: { view: RoomView }) {
  const eligible = view.players.filter((p) => view.eligibleIds.includes(p.id));
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 items-center">
      {eligible.map((p) => {
        const done = view.answeredIds.includes(p.id);
        return (
          <span key={p.id} className={`text-sm transition flex items-center gap-2 ${done ? "text-bone" : "text-bone/30"} ${p.online ? "" : "line-through"}`}>
            <Avatar photo={p.photo} name={p.name} size={26} ring={done ? "#D6DE5B" : undefined} className={done ? "" : "opacity-40"} />
            {p.name}
          </span>
        );
      })}
      {view.question?.kind === "honoreeVs" && (
        <span className={`label ${view.honoreeAnswered ? "text-acid" : "anim-pulse"}`}>
          {view.honoreeAnswered ? `${view.honoree.name} has answered` : `Waiting for ${view.honoree.name}`}
        </span>
      )}
    </div>
  );
}

function QuestionStage({ view, now, run }: { view: RoomView; now: () => number; run: (a: Record<string, unknown>) => void }) {
  const q = view.question!;
  const many = q.options.length > 4;
  if (q.kind === "men")
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex justify-between items-baseline">
          <p className="label">
            {q.bonus ? "Bonus" : `${view.round!.qIndex + 1} / ${view.round!.qCount}`} · votes are anonymous
          </p>
          <span className="text-5xl">
            <Timer variant="number" deadline={view.deadline} total={q.timerSec} now={now} paused={view.paused} pausedRemaining={view.pausedRemaining} onExpire={() => run({ type: "timeout" })} />
          </span>
        </div>
        <div className="mt-3">
          <Timer deadline={view.deadline} total={q.timerSec} now={now} paused={view.paused} pausedRemaining={view.pausedRemaining} ticks />
        </div>
        <h1 className="display text-[clamp(2.2rem,4.4vw,4.8rem)] my-8 max-w-[30ch] anim-rise">{q.prompt}</h1>
        {q.type === "kfm" && <p className="font-serif italic text-2xl text-bone/55 -mt-4 mb-8">Three men. Three fates. Decide on your phone.</p>}
        <div className="flex-1 mb-6">
          <Lineup view={view} large />
        </div>
        <AnswerTally view={view} />
      </div>
    );
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex justify-between items-baseline">
        <p className="label">
          {q.kind === "tiebreak" ? "Tie-breaker · closest wins" : `${view.round!.qIndex + 1} / ${view.round!.qCount}`}
          {q.category && ` · ${q.category}`}
          {q.difficulty && ` · ${q.difficulty}`}
          {view.placeholderWarning && <span className="text-rouge ml-3">Placeholder: edit in admin</span>}
        </p>
        <span className="text-5xl">
          <Timer variant="number" deadline={view.deadline} total={q.timerSec} now={now} paused={view.paused} pausedRemaining={view.pausedRemaining} onExpire={() => run({ type: "timeout" })} />
        </span>
      </div>
      <div className="mt-3">
        <Timer deadline={view.deadline} total={q.timerSec} now={now} paused={view.paused} pausedRemaining={view.pausedRemaining} ticks />
      </div>

      <div className={`flex-1 grid ${q.image ? "lg:grid-cols-[auto_1fr]" : ""} gap-12 items-center py-10`}>
        {q.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={q.image} alt="" className="max-h-[52vh] max-w-[38vw] object-contain anim-fade" />
        )}
        <div>
          {q.kind === "honoreeVs" && <p className="label mb-4 anim-rise">What will she say?</p>}
          {q.kind === "whoSaid" && <p className="label mb-4 anim-rise">Who said it?</p>}
          <PromptText text={q.kind === "whoSaid" ? `“${q.prompt}”` : q.prompt} className={`anim-rise max-w-[26ch] ${q.kind === "whoSaid" ? "italic" : ""}`} />
          {q.type === "text" && <p className="font-serif italic text-2xl text-bone/50 mt-8">Write your answer on your phone.</p>}
          {q.type === "number" && <p className="font-serif italic text-2xl text-bone/50 mt-8">A number, on your phone. Closest wins.</p>}
        </div>
      </div>

      {(q.type === "mc" || q.type === "vote") && (
        <ol className={`grid gap-x-10 gap-y-4 mb-8 ${many ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"}`}>
          {q.options.map((o, i) => (
            <li key={i} className="flex items-baseline gap-4 border-t border-bone/15 pt-3 anim-rise" style={{ animationDelay: `${150 + i * 60}ms` }}>
              <span className="font-mono text-sm text-bone/40">{LETTERS[i]}</span>
              <span className={`${many ? "text-2xl" : "text-[clamp(1.4rem,2.4vw,2.4rem)]"} font-serif`}>{o}</span>
            </li>
          ))}
        </ol>
      )}
      <AnswerTally view={view} />
    </div>
  );
}

function RevealStage({ view, run }: { view: RoomView; run: (a: Record<string, unknown>) => void }) {
  const q = view.question!;
  const r = view.reveal!;
  const scorers = r.results.filter((x) => x.points > 0);
  return (
    <div className="flex-1 flex flex-col gap-10">
      <div>
        <p className="label mb-3 text-bone/60 truncate">{q.kind === "whoSaid" ? `“${q.prompt}”` : q.prompt}</p>
        <p className="label mb-2">{q.kind === "men" ? "The room’s choice" : q.kind === "mostLikely" ? "The room has spoken" : q.kind === "honoreeVs" ? "Straight from her" : "The answer"}</p>
        <h1 className="display text-[clamp(3rem,7vw,7.5rem)] anim-rise">{revealHeadline(view)}</h1>
        {r.surprise && <p className="label text-acid mt-3">Surprise bonus · only a few saw that coming</p>}
        {r.note && <p className="font-serif italic text-2xl text-bone/55 mt-4 anim-rise delay-2">{r.note}</p>}
      </div>

      {q.kind === "men" && q.type === "vote" && <MenResults view={view} />}
      {q.type === "kfm" && <KfmTable reveal={r} large />}

      {q.kind !== "men" && q.type === "vote" && (
        <div className="max-w-4xl w-full">
          <Bars large rows={voteRows(view).slice(0, 6)} highlight={(i) => r.voteWinners?.includes(voteRows(view)[i].label) ?? false} />
        </div>
      )}

      {q.type === "mc" && (
        <div className="max-w-4xl w-full">
          <Bars
            large={q.options.length <= 4}
            rows={q.options.map((label, i) => ({ label, count: r.distribution[i] ?? 0 }))}
            highlight={(i) => i === r.correctIndex}
          />
        </div>
      )}

      {(q.type === "text" || q.type === "number") && (
        <div>
          <p className="label mb-3">{q.type === "text" ? "Tap to overrule the marking" : "Their guesses"}</p>
          <RevealResultList reveal={r} teams={view.teams} players={view.players} onMark={q.type === "text" ? (pid, correct) => run({ type: "mark", playerId: pid, correct }) : undefined} />
        </div>
      )}

      {r.teamResults.length > 0 && (
        <div className="flex gap-12">
          {r.teamResults.map((t) => (
            <p key={t.teamId} className="flex items-center gap-3">
              <TeamDot color={teamColor(view.teams, t.teamId)} />
              <span className="display text-3xl">{view.teams.find((x) => x.id === t.teamId)?.name}</span>
              <span className={`font-mono text-3xl ${t.points >= 0 ? "text-acid" : "text-rouge"}`}>
                {t.points > 0 ? "+" : ""}
                {t.points}
              </span>
            </p>
          ))}
        </div>
      )}

      {q.type === "mc" && scorers.length > 0 && (
        <p className="text-bone/60 mt-auto">
          <span className="label mr-3">Points</span>
          {scorers.map((s) => `${s.name} +${s.points}`).join("  ·  ")}
        </p>
      )}
    </div>
  );
}

/** Round 3 results: the lineup re-sorted by votes, counts ticking up, the winner lit. */
function MenResults({ view }: { view: RoomView }) {
  const q = view.question!;
  const r = view.reveal!;
  const rows = q.options.map((name, i) => ({ name, i, n: r.distribution[i] ?? 0, photo: q.optionPhotos?.[i] })).sort((a, b) => b.n - a.n);
  const max = Math.max(0, ...rows.map((x) => x.n));
  const { cols, maxWidth } = screenGrid(rows.length, 330);
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth }}>
      {rows.map((x, k) => {
        const win = x.n === max && max > 0;
        return (
          <div key={x.i} className="anim-rise" style={{ animationDelay: `${(rows.length - 1 - k) * 220}ms` }}>
            <Portrait photo={x.photo} name={x.name} dim={!win} className={win ? "outline outline-4 outline-acid" : ""}>
              <span className={`absolute right-2 bottom-2 font-mono text-4xl px-2 ${win ? "bg-acid text-ink" : "bg-ink/70 text-bone"}`}>{x.n}</span>
            </Portrait>
            <p className={`mt-2 display text-[clamp(1.2rem,2vw,2rem)] ${win ? "text-acid" : "text-bone/60"}`}>{x.name}</p>
          </div>
        );
      })}
    </div>
  );
}

/** The unmasking: each man, then the girl behind him. The biggest moment of the night. */
function UnmaskStage({ view }: { view: RoomView }) {
  const u = view.unmask!;
  if (u.step === 0)
    return (
      <div className="flex-1 flex flex-col justify-center">
        <p className="label mb-4 anim-rise">The unmasking</p>
        <h1 className="display text-[clamp(3.5rem,8vw,9rem)] anim-rise delay-1">
          Who were these men, <span className="italic text-acid">really?</span>
        </h1>
        <div className="flex gap-3 mt-12">
          {u.cards.map((c, i) => (
            <div key={c.token} className="flex-1 max-w-[14rem] anim-rise" style={{ animationDelay: `${300 + i * 120}ms` }}>
              <Portrait photo={c.malePhoto} name={c.maleName} />
              <p className="mt-2 font-serif text-xl">{c.maleName}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (u.step > u.total)
    return (
      <div className="flex-1 flex flex-col">
        <p className="label mb-3 anim-rise">The full lineup</p>
        <h1 className="display text-[clamp(2.4rem,4.6vw,5rem)] mb-8 anim-rise">
          Questionable taste, <span className="italic">explained.</span>
        </h1>
        <div
          className="grid gap-x-6 gap-y-6"
          style={{
            gridTemplateColumns: `repeat(${u.total <= 4 ? u.total : u.total <= 6 ? 3 : 5}, minmax(0, 1fr))`,
            maxWidth: u.total <= 4 ? undefined : `calc(${u.total <= 6 ? 3 : 5} * ((100vh - 330px) / ${u.total <= 6 ? 2 : 2} - 70px) * 1.6)`,
          }}
        >
          {u.cards.map((c, i) => (
            <div key={c.token} className="anim-rise" style={{ animationDelay: `${i * 140}ms` }}>
              <div className="grid grid-cols-2 gap-1.5">
                <Portrait photo={c.malePhoto} name={c.maleName} />
                <Portrait photo={c.femalePhoto} name={c.femaleName ?? "?"} />
              </div>
              <p className="mt-2 font-serif text-2xl">
                {c.maleName} <span className="italic text-bone/45">is</span> <span className="text-acid">{c.femaleName}</span>
              </p>
              <p className="label">
                {c.votes} vote{c.votes === 1 ? "" : "s"} · won {c.wins}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  const c = u.cards[u.step - 1];
  return (
    <div className="flex-1 grid lg:grid-cols-[1fr_1fr] gap-10 items-center" key={c.token}>
      <div className="grid grid-cols-2 gap-4">
        <div className="anim-rise">
          <Portrait photo={c.malePhoto} name={c.maleName} />
          <p className="mt-3 display text-4xl">{c.maleName}</p>
        </div>
        <div className="anim-unveil">
          <Portrait photo={c.femalePhoto} name={c.femaleName ?? "?"} />
          <p className="mt-3 display text-4xl text-acid">{c.femaleName}</p>
        </div>
      </div>
      <div>
        <p className="label mb-4 anim-rise">
          {u.step} of {u.total} · {c.votes} vote{c.votes === 1 ? "" : "s"} · topped {c.wins} question{c.wins === 1 ? "" : "s"}
        </p>
        <h1 className="display text-[clamp(3rem,6.5vw,7.5rem)] leading-[0.9]">
          <span className="anim-rise block">{c.maleName}</span>
          <span className="anim-unveil block italic text-bone/50 text-[0.6em]">is actually</span>
          <span className="anim-unveil block text-acid" style={{ animationDelay: "1.9s" }}>
            {c.femaleName}.
          </span>
        </h1>
      </div>
    </div>
  );
}

function LeaderboardStage({ view }: { view: RoomView }) {
  if (view.scoresHidden) {
    const nextTitle = view.round && view.round.index + 1 < view.round.total ? view.roundTitles[view.round.index + 1]?.title : null;
    return (
      <div className="flex-1 flex flex-col justify-center">
        <p className="label mb-4 anim-rise">Round {ROMAN[view.round?.index ?? 0]} complete</p>
        <h1 className="display text-[clamp(3rem,7vw,7.5rem)] anim-rise delay-1">
          The scores are <span className="italic text-acid">sealed.</span>
        </h1>
        <p className="font-serif italic text-3xl text-bone/55 mt-6 anim-rise delay-2">Everything is being counted. All will be revealed at the end.</p>
        {view.fact && (
          <blockquote className="mt-12 max-w-3xl anim-rise delay-4">
            <p className="label mb-2">For the record</p>
            <p className="font-serif text-2xl leading-snug">{view.fact}</p>
          </blockquote>
        )}
        {nextTitle && <p className="mt-12 label anim-rise delay-5">Next: {nextTitle}</p>}
      </div>
    );
  }
  const isLast = view.round && view.round.index + 1 >= view.round.total;
  return (
    <div className="flex-1 grid lg:grid-cols-[1.4fr_1fr] gap-16 items-center">
      <div>
        <p className="label mb-6">After round {ROMAN[view.round?.index ?? 0]}{isLast ? " · that was the last" : ""}</p>
        {view.teamsEnabled ? <Standings teams={view.teams} large /> : <Ranking players={view.players} large />}
      </div>
      <div>
        <p className="label mb-3">Individually</p>
        <TopPlayers players={view.players} teams={view.teams} limit={6} />
        {view.fact && (
          <blockquote className="mt-10 anim-rise delay-5">
            <p className="label mb-2">For the record</p>
            <p className="font-serif text-2xl leading-snug">{view.fact}</p>
          </blockquote>
        )}
        {view.round && !isLast && (
          <p className="mt-10 font-serif italic text-2xl text-bone/50">Next: {view.roundTitles[view.round.index + 1]?.title}</p>
        )}
      </div>
    </div>
  );
}

function FinalStage({ view, run }: { view: RoomView; run: (a: Record<string, unknown>) => void }) {
  const solo = !view.teamsEnabled;
  const sortedTeams = [...view.teams].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const sortedPlayers = [...view.players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const winner = solo ? sortedPlayers[0]?.name : sortedTeams[0]?.name;
  const revealDelay = solo ? view.players.length * 650 : 600;
  const [i, setI] = useState(0);
  const items = view.messages;
  const photos = view.honoree.photos;
  useEffect(() => {
    const t = setInterval(() => setI((x) => x + 1), 9000);
    return () => clearInterval(t);
  }, []);
  const msg = items.length ? items[i % items.length] : null;
  const photo = photos.length ? photos[i % photos.length] : null;

  return (
    <div className="flex-1 relative grid gap-12 items-center lg:grid-cols-[1.2fr_1fr]">
      <div className="relative z-10">
        <TitleLockup className="anim-rise" size="clamp(2.8rem, 5vw, 5.4rem)" />
        <p className="label mt-8 mb-4">The final scores</p>
        <div className="max-w-2xl">{solo ? <Ranking players={view.players} large /> : <Standings teams={view.teams} large />}</div>
      </div>
      <div className="relative z-10 flex flex-col justify-center gap-10">
        <div className="anim-rise" style={{ animationDelay: `${revealDelay}ms` }}>
          {view.tie ? (
            <button className="btn-acid text-lg px-8 py-5" onClick={() => run({ type: "tiebreak" })}>
              Level on points. Play the tie-breaker
            </button>
          ) : (
            <p className="display text-[clamp(2.4rem,4.6vw,5rem)]">
              <span className="italic text-acid">{winner}</span> {solo ? "wins." : "win."}
            </p>
          )}
          <p className="font-serif italic text-[clamp(1.6rem,3vw,3rem)] mt-4 glint">Happy fortieth, {view.honoree.name}.</p>
          {view.honoree.tagline && <p className="text-bone/50 mt-2">{view.honoree.tagline}</p>}
        </div>
      {(photo || msg) && <div className="flex flex-col justify-center">
        {photo && (
          <div key={`p${i}`} className="aspect-[4/5] max-h-[40vh] overflow-hidden anim-fade mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="w-full h-full object-cover anim-drift" />
          </div>
        )}
        {msg && (
          <blockquote key={`m${i}`} className="anim-rise">
            <p className="font-serif text-[clamp(1.4rem,2.2vw,2.2rem)] leading-snug">“{msg.text}”</p>
            <footer className="label mt-4">{msg.from}</footer>
          </blockquote>
        )}
      </div>}
      </div>
    </div>
  );
}

function Dock({ view, run, hide }: { view: RoomView; run: (a: Record<string, unknown>) => void; hide: () => void }) {
  const [more, setMore] = useState(false);
  const primary: Record<RoomView["phase"], string> = {
    lobby: "Start the game",
    round_intro: view.round?.qCount ? "Begin round" : "Next round",
    wager: "Lock wagers · show question",
    question: view.question?.kind === "men" ? "Close voting" : "Reveal now",
    reveal: view.round && view.question && view.round.qIndex + 1 >= view.round.qCount && view.round.kind === "men" ? "Begin the unmasking" : "Next",
    unmask: !view.unmask ? "Next" : view.unmask.step === 0 ? "Unmask the first" : view.unmask.step < view.unmask.total ? "Unmask the next" : view.unmask.step === view.unmask.total ? "Show them all" : "Continue",
    leaderboard: view.round && view.round.index + 1 < view.round.total ? "Next round" : "Reveal the final scores",
    final: "",
  };
  const label = primary[view.phase];
  return (
    <div className="sticky bottom-0 z-40 bg-ink/90 backdrop-blur border-t border-bone/10">
      {more && (
        <div className="px-6 lg:px-12 pt-4 pb-2 flex flex-wrap gap-2 items-center anim-fade">
          <span className="label mr-2">Adjust</span>
          {view.teams.map((t) => (
            <span key={t.id} className="flex items-center gap-1 mr-4">
              <TeamDot color={teamColor(view.teams, t.id)} />
              <span className="text-sm mx-1">{t.name}</span>
              {[-50, 50, 100].map((d) => (
                <button key={d} className="btn-ghost btn-sm" onClick={() => run({ type: "adjust", target: "team", targetId: t.id, delta: d })}>
                  {d > 0 ? "+" : ""}
                  {d}
                </button>
              ))}
            </span>
          ))}
          <span className="flex-1" />
          {view.phase !== "lobby" && view.phase !== "final" && (
            <>
              <button className="btn-ghost btn-sm" onClick={() => confirm("Restart this round? Its points are cleared.") && run({ type: "restartRound" })}>
                Restart round
              </button>
              <button className="btn-ghost btn-sm" onClick={() => run({ type: "skipRound" })}>
                Skip round
              </button>
            </>
          )}
          {view.phase === "lobby" && (
            <>
              <button className="btn-ghost btn-sm" onClick={() => run({ type: "shuffleTeams" })}>
                Shuffle teams
              </button>
              <CopyHostLink code={view.code} />
            </>
          )}
          {view.phase !== "lobby" && (
            <button className="btn-ghost btn-sm text-rouge" onClick={() => confirm("Back to the lobby? All scores reset; players stay.") && run({ type: "backToLobby" })}>
              Reset game
            </button>
          )}
        </div>
      )}
      <div className="px-6 lg:px-12 py-3 flex items-center gap-2">
        <button className="label hover:text-bone mr-2" onClick={hide} title="Hide controls (H)">
          Hide
        </button>
        <button className="btn-ghost btn-sm" onClick={() => setMore(!more)}>
          {more ? "Fewer" : "More"}
        </button>
        {view.phase !== "lobby" && view.phase !== "final" && (
          <button className="btn-ghost btn-sm" onClick={() => run({ type: view.paused ? "resume" : "pause" })}>
            {view.paused ? "Resume" : "Pause"}
          </button>
        )}
        {view.phase === "question" && (
          <button className="btn-ghost btn-sm" onClick={() => run({ type: "addTime", seconds: 10 })}>
            +10s
          </button>
        )}
        {(view.phase === "question" || view.phase === "wager") && (
          <button className="btn-ghost btn-sm" onClick={() => run({ type: "skip" })}>
            Skip question
          </button>
        )}
        <span className="flex-1" />
        <span className="label hidden md:inline mr-3">
          {view.players.filter((p) => p.online).length}/{view.players.length} online
        </span>
        {view.phase === "final" ? (
          <button className="btn-ghost btn-sm" onClick={() => confirm("Play again with the same players?") && run({ type: "backToLobby" })}>
            Play again
          </button>
        ) : (
          <button className={`btn-acid ${view.phase === "question" && view.allIn ? "ring-4 ring-acid/40 anim-pulse" : ""}`} onClick={() => run({ type: view.phase === "lobby" ? "start" : "next" })}>
            {view.phase === "question" && view.allIn ? `Everyone’s in · ${label}` : label}
          </button>
        )}
      </div>
    </div>
  );
}

function CopyHostLink({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn-ghost btn-sm"
      onClick={async () => {
        const t = store.get<string>(hostKey(code));
        const url = `${window.location.origin}/host/${code}#t=${t}`;
        try {
          await navigator.clipboard.writeText(url);
          setDone(true);
        } catch {
          prompt("Host link (keep it private):", url);
        }
      }}
      title="Open the host screen on another device, like a TV"
    >
      {done ? "Copied" : "Copy host link"}
    </button>
  );
}
