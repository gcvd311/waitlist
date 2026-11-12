"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { hostKey, playerKey, ROMAN, store, teamColor, type PlayerCreds } from "@/lib/client";
import { useRoom } from "@/hooks/useRoom";
import { sfx } from "@/lib/sound";
import { MuteButton, TeamDot, Timer, Toast } from "@/components/ui";
import { Bars, OptionLetter, revealHeadline, Standings, voteRows } from "@/components/game";
import HostRemote from "@/components/HostRemote";
import type { RoomView } from "@/lib/types";

export default function PlayPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const router = useRouter();
  const [creds, setCreds] = useState<PlayerCreds | null>(null);
  const [hostToken, setHostToken] = useState<string | null>(null);

  useEffect(() => {
    const c = store.get<PlayerCreds>(playerKey(code));
    if (!c) router.replace(`/join/${code}`);
    else setCreds(c);
    setHostToken(store.get<string>(hostKey(code)));
  }, [code, router]);

  const auth = useMemo(() => (creds ? { pid: creds.pid, secret: creds.secret } : null), [creds]);
  const { view, error, connected, act, now } = useRoom(code, auth);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (error?.status === 401) {
      store.del(playerKey(code));
      router.replace(`/join/${code}`);
    }
  }, [error, code, router]);

  usePhaseSounds(view);

  if (error?.status === 404)
    return (
      <Shell>
        <div className="flex-1 flex flex-col justify-center">
          <p className="label mb-3">Room {code}</p>
          <h1 className="display text-5xl">This room has closed.</h1>
          <button className="btn-ghost mt-10" onClick={() => (store.del(playerKey(code)), router.replace("/join"))}>
            Join another
          </button>
        </div>
      </Shell>
    );

  if (!view || !view.me)
    return (
      <Shell>
        <div className="flex-1 grid place-items-center label anim-pulse">Finding your seat…</div>
      </Shell>
    );

  const me = view.me;
  const myTeam = view.teams.find((t) => t.id === me.team);
  const myScore = view.players.find((p) => p.id === me.id)?.score ?? 0;

  return (
    <Shell>
      <header className="flex items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <TeamDot color={teamColor(view.teams, me.team)} />
          <span className="truncate">{me.name}</span>
          {me.isHonoree && <span className="label text-acid">Guest of honour</span>}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="font-mono text-sm tabular-nums">{myScore}</span>
          <MuteButton />
        </div>
      </header>
      {!connected && <p className="label text-rouge mb-2 anim-pulse">Reconnecting…</p>}

      <div className="flex-1 flex flex-col" key={`${view.phase}-${view.question?.key ?? view.round?.index ?? ""}`}>
        <PlayerPhase view={view} act={act} now={now} setToast={setToast} teamName={myTeam?.name ?? ""} />
      </div>

      {view.paused && (
        <div className="fixed inset-0 z-40 bg-ink/90 backdrop-blur-sm grid place-items-center anim-fade">
          <div className="text-center">
            <p className="label mb-3">Paused</p>
            <p className="display text-5xl italic">Top up your glass.</p>
          </div>
        </div>
      )}
      {hostToken && <HostRemote code={code} hostToken={hostToken} view={view} />}
      <Toast message={toast} onDone={clearToast} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-[100dvh] px-5 pt-5 pb-28 max-w-md mx-auto flex flex-col">{children}</main>;
}

function usePhaseSounds(view: RoomView | null) {
  const last = useRef<string>("");
  useEffect(() => {
    if (!view) return;
    const sig = `${view.phase}:${view.question?.key ?? ""}:${view.round?.index ?? ""}`;
    if (sig === last.current) return;
    const first = last.current === "";
    last.current = sig;
    if (first) return;
    if (view.phase === "round_intro") sfx.round();
    if (view.phase === "final") sfx.finale();
    if (view.phase === "reveal" && view.reveal && view.me) {
      const mine = view.reveal.results.find((r) => r.playerId === view.me!.id);
      if (mine?.value === null || !mine) sfx.reveal();
      else if (mine.correct || mine.points > 0) sfx.right();
      else sfx.wrong();
    }
  }, [view]);
}

type ActFn = ReturnType<typeof useRoom>["act"];

function PlayerPhase({
  view,
  act,
  now,
  setToast,
  teamName,
}: {
  view: RoomView;
  act: ActFn;
  now: () => number;
  setToast: (s: string) => void;
  teamName: string;
}) {
  switch (view.phase) {
    case "lobby":
      return <Lobby view={view} act={act} setToast={setToast} teamName={teamName} />;
    case "round_intro":
      return (
        <div className="flex-1 flex flex-col justify-center">
          <p className="label mb-4 anim-rise">
            Round {ROMAN[view.round!.index]} of {ROMAN[view.round!.total - 1]}
          </p>
          <h1 className="display text-6xl anim-rise delay-1">{view.round!.title}</h1>
          <p className="mt-5 text-bone/60 font-serif italic text-2xl anim-rise delay-2">{view.round!.subtitle}</p>
          <p className="label mt-14 anim-pulse">Eyes on the big screen</p>
        </div>
      );
    case "wager":
      return <Wager view={view} act={act} setToast={setToast} />;
    case "question":
      return <Question view={view} act={act} now={now} setToast={setToast} />;
    case "reveal":
      return <Reveal view={view} />;
    case "leaderboard":
      return (
        <div className="flex-1 flex flex-col justify-center gap-10">
          <p className="label anim-rise">After round {ROMAN[view.round?.index ?? 0]}</p>
          <Standings teams={view.teams} />
          <p className="text-bone/50 text-sm">
            You’re #{[...view.players].sort((a, b) => b.score - a.score).findIndex((p) => p.id === view.me!.id) + 1} of {view.players.length} individually.
          </p>
        </div>
      );
    case "final":
      return <Final view={view} />;
  }
}

function Lobby({ view, act, setToast, teamName }: { view: RoomView; act: ActFn; setToast: (s: string) => void; teamName: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const teammates = view.players.filter((p) => p.team === view.me!.team);
  return (
    <div className="flex-1 flex flex-col gap-12 pt-6">
      <section>
        <p className="label mb-3 anim-rise">You’re in</p>
        <h1 className="display text-6xl anim-rise delay-1">
          <span className="italic">Team</span> {teamName}
        </h1>
        <p className="mt-4 text-bone/60 anim-rise delay-2">
          {teammates.map((p) => p.name).join(", ")}
        </p>
      </section>

      <section className="anim-rise delay-3">
        <p className="label mb-2">While we wait</p>
        <h2 className="display text-3xl mb-2">Confess something.</h2>
        <p className="text-sm text-bone/55 mb-4 leading-relaxed">
          An opinion, a story, a minor crime. Later, everyone guesses who wrote it. {view.myConfessions}/3 sent.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const r = await act({ type: "confess", text });
            setBusy(false);
            if (r.ok) {
              setText("");
              sfx.lock();
            }
            if (r.message) setToast(r.message);
          }}
          className="space-y-3"
        >
          <textarea
            className="box min-h-[96px]"
            value={text}
            maxLength={280}
            onChange={(e) => setText(e.target.value)}
            placeholder="I once…"
            disabled={view.myConfessions >= 3}
          />
          <button className="btn-ghost w-full" disabled={busy || text.trim().length < 3 || view.myConfessions >= 3}>
            Seal it
          </button>
        </form>
      </section>

      <p className="label text-center anim-pulse">Waiting for the host · {view.players.length} here</p>
    </div>
  );
}

function Wager({ view, act, setToast }: { view: RoomView; act: ActFn; setToast: (s: string) => void }) {
  const team = view.teams.find((t) => t.id === view.me!.team)!;
  const [amount, setAmount] = useState<number>(team.wager ?? 0);
  const max = team.maxWager;
  const set = async (n: number) => {
    const v = Math.max(0, Math.min(max, Math.round(n)));
    setAmount(v);
    const r = await act({ type: "wager", key: view.question!.key, amount: v });
    if (!r.ok && r.message) setToast(r.message);
    else sfx.tap();
  };
  return (
    <div className="flex-1 flex flex-col justify-center gap-8">
      <div>
        <p className="label mb-3">
          Final 40 · {view.round!.qIndex + 1} of {view.round!.qCount}
        </p>
        <h1 className="display text-5xl">
          What will <span className="italic">{team.name}</span> risk?
        </h1>
        <p className="mt-3 text-bone/55 text-sm">
          {view.question?.category ? `Category: ${view.question.category}. ` : ""}Your team has {team.score}. Win it, or lose it. Anyone on the team can set it; majority answer decides.
        </p>
      </div>
      <div className="text-center font-mono text-7xl tabular-nums">{amount}</div>
      <input type="range" min={0} max={max} step={10} value={amount} onChange={(e) => setAmount(Number(e.target.value))} onMouseUp={() => set(amount)} onTouchEnd={() => set(amount)} />
      <div className="grid grid-cols-4 gap-2">
        {[0, 0.25, 0.5, 1].map((f) => (
          <button key={f} className="btn-ghost btn-sm" onClick={() => set(max * f)}>
            {f === 0 ? "None" : f === 1 ? "All" : `${f * 100}%`}
          </button>
        ))}
      </div>
      <p className="label text-center">Locked wager: {team.wager ?? 0}</p>
    </div>
  );
}

function Question({ view, act, now, setToast }: { view: RoomView; act: ActFn; now: () => number; setToast: (s: string) => void }) {
  const q = view.question!;
  const me = view.me!;
  const [pending, setPending] = useState<string | number | null>(null);
  const [text, setText] = useState("");
  const chosen = me.answer ?? pending;
  const locked = me.answer !== null && me.answer !== undefined;

  async function submit(value: string | number) {
    if (locked || pending !== null) return;
    sfx.unlock();
    setPending(value);
    const r = await act({ type: "answer", key: q.key, value });
    if (!r.ok) {
      setPending(null);
      if (r.message) setToast(r.message);
    } else sfx.lock();
  }

  const header = (
    <>
      <div className="flex justify-between items-baseline mb-2">
        <span className="label truncate">
          {q.kind === "tiebreak" ? "Tie-breaker" : view.round?.title} {q.kind !== "tiebreak" && `· ${view.round!.qIndex + 1}/${view.round!.qCount}`}
        </span>
        <span className="text-2xl">
          <Timer variant="number" deadline={view.deadline} total={q.timerSec} now={now} paused={view.paused} pausedRemaining={view.pausedRemaining} onExpire={() => act({ type: "timeout" })} />
        </span>
      </div>
      <Timer deadline={view.deadline} total={q.timerSec} now={now} paused={view.paused} pausedRemaining={view.pausedRemaining} ticks />
    </>
  );

  if (me.role === "sitout")
    return (
      <div className="flex-1 flex flex-col">
        {header}
        <div className="flex-1 flex flex-col justify-center">
          <h1 className="display text-4xl mb-6 text-bone/50">{q.prompt}</h1>
          <p className="display text-5xl italic">You know this one. Obviously.</p>
          <p className="mt-4 text-bone/55">Sit back and watch them try.</p>
        </div>
      </div>
    );

  return (
    <div className="flex-1 flex flex-col">
      {header}
      <div className="pt-6 pb-6">
        {me.role === "honoree" && <p className="label text-acid mb-3">Answer honestly. Nobody can see.</p>}
        {q.kind === "honoreeVs" && me.role === "guess" && <p className="label mb-3">What will she say?</p>}
        {q.kind === "whoSaid" && <p className="label mb-3">Who said it?</p>}
        <h1 className={`display ${q.prompt.length > 90 ? "text-3xl" : "text-4xl"} ${q.kind === "whoSaid" ? "italic" : ""} anim-rise`}>
          {q.kind === "whoSaid" ? `“${q.prompt}”` : q.prompt}
        </h1>
        {q.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={q.image} alt="" className="mt-5 w-full max-h-64 object-cover anim-fade" />
        )}
      </div>

      {(q.type === "mc" || q.type === "vote") && (
        <div className="space-y-2 mt-auto">
          {q.options.map((opt, i) => {
            const active = chosen === i;
            return (
              <button
                key={i}
                data-option={i}
                disabled={locked || pending !== null}
                onClick={() => submit(i)}
                className={`w-full text-left flex items-center gap-3 px-4 py-4 border transition anim-rise ${
                  active ? "bg-acid text-ink border-acid" : locked ? "border-bone/10 text-bone/30" : "border-bone/20 hover:border-bone/60 active:bg-bone/10"
                }`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <OptionLetter i={i} active={active} />
                <span className="text-[17px] leading-snug">{opt}</span>
              </button>
            );
          })}
        </div>
      )}

      {(q.type === "text" || q.type === "number") && (
        <form
          className="mt-auto space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) submit(q.type === "number" ? Number(text) : text.trim());
          }}
        >
          {locked ? (
            <p className="display text-4xl italic text-acid">{String(me.answer)}</p>
          ) : (
            <>
              <input
                className="field font-serif text-3xl"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={q.type === "number" ? "Your number" : "Your answer"}
                inputMode={q.type === "number" ? "decimal" : "text"}
                maxLength={140}
                autoFocus
              />
              <button className="btn-acid w-full py-4" disabled={!text.trim() || pending !== null}>
                Lock it in
              </button>
            </>
          )}
        </form>
      )}

      <p className="label text-center mt-6">
        {locked ? "Locked in · " : ""}
        {view.answeredIds.length}/{view.eligibleIds.length} answered
      </p>
    </div>
  );
}

function Reveal({ view }: { view: RoomView }) {
  const q = view.question!;
  const r = view.reveal!;
  const me = view.me!;
  const mine = r.results.find((x) => x.playerId === me.id);
  const team = r.teamResults.find((t) => t.teamId === me.team);
  const verdict =
    me.role !== "guess" ? null : !mine || mine.value === null ? "No answer." : mine.correct || mine.points > 0 ? "Correct." : "Not quite.";

  return (
    <div className="flex-1 flex flex-col justify-center gap-8">
      {verdict && (
        <div className="anim-rise">
          <h1 className={`display text-7xl ${verdict === "Correct." ? "text-acid" : "text-bone"} italic`}>{verdict}</h1>
          {mine && mine.points > 0 && <p className="font-mono text-2xl mt-2">+{mine.points}</p>}
          {r.surprise && mine?.correct && <p className="label text-acid mt-2">Surprise bonus</p>}
        </div>
      )}
      {team && team.points !== 0 && (
        <p className={`font-mono text-xl ${team.points > 0 ? "text-acid" : "text-rouge"}`}>
          Team {team.points > 0 ? "+" : ""}
          {team.points}
        </p>
      )}
      <div className="anim-rise delay-2">
        <p className="label mb-2">{q.kind === "mostLikely" ? "The room has spoken" : "The answer"}</p>
        <p className="display text-4xl">{revealHeadline(view)}</p>
        {r.note && <p className="mt-3 text-bone/55 font-serif italic text-xl">{r.note}</p>}
      </div>
      {q.type === "vote" && (
        <div className="anim-rise delay-3">
          <Bars rows={voteRows(view)} highlight={(i) => r.voteWinners?.includes(voteRows(view)[i].label) ?? false} />
        </div>
      )}
      {mine && mine.value !== null && q.type !== "vote" && (
        <p className="text-bone/50 text-sm">You said: <span className="font-serif italic text-lg text-bone/80">{mine.display}</span></p>
      )}
    </div>
  );
}

function Final({ view }: { view: RoomView }) {
  const sorted = [...view.teams].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const mine = view.me!.team === winner?.id;
  return (
    <div className="flex-1 flex flex-col justify-center gap-10">
      <p className="label anim-rise">Final</p>
      {view.tie ? (
        <h1 className="display text-6xl anim-rise delay-1">
          A dead heat. <span className="italic">Tie-breaker incoming.</span>
        </h1>
      ) : (
        <h1 className="display text-6xl anim-rise delay-1">
          <span className="italic">{winner?.name}</span> take it.{mine && <span className="block text-acid text-4xl mt-3">That’s you.</span>}
        </h1>
      )}
      <Standings teams={view.teams} />
      <p className="display text-3xl italic text-bone/70 anim-rise delay-4">Happy fortieth, {view.honoree.name}.</p>
    </div>
  );
}
