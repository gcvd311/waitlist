"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { hostKey, playerKey, ROMAN, squarePhoto, store, teamColor, type PlayerCreds } from "@/lib/client";
import { useRoom } from "@/hooks/useRoom";
import { sfx } from "@/lib/sound";
import { Avatar, Mascot, MuteButton, PhotoPicker, Portrait, Timer, Toast, TitleLockup } from "@/components/ui";
import { Crown, Heart, Sparkle } from "@/components/Cat";
import { Bars, KfmTable, Lineup, OptionLetter, Ranking, revealHeadline, Standings, voteRows } from "@/components/game";
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
  const myScore = view.players.find((p) => p.id === me.id)?.score ?? null;

  const inRound = view.round && ["question", "reveal", "wager"].includes(view.phase);
  const showTitle = view.phase === "lobby" || view.phase === "final";
  return (
    <Shell>
      <header className="flex items-center justify-between gap-3 pb-3 px-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar photo={me.photo} name={me.name} size={30} ring="#FFF5EC" />
          <span className="truncate font-semibold">{me.name}</span>
          {me.isHonoree && <span className="chip">Birthday girl</span>}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {myScore !== null && <span className="font-mono text-lg tabular-nums">{myScore}</span>}
          <MuteButton />
        </div>
      </header>
      {!connected && <p className="label text-rouge mb-2 anim-pulse">Reconnecting…</p>}

      {showTitle && (
        <div className="relative pt-2 pb-6">
          <TitleLockup size="clamp(2.4rem, 12vw, 3.4rem)" />
          <Sparkle className="absolute left-3 top-3 w-6 text-bone/80 anim-pulse" />
          <Sparkle className="absolute right-4 top-12 w-4 text-bone/70 anim-pulse" style={{ animationDelay: "0.6s" }} />
        </div>
      )}
      {inRound && view.round && <RoundHeader view={view} />}
      {view.phase === "unmask" && <h2 className="title-face text-center text-4xl -rotate-[3deg] pt-1 pb-5">The big reveal</h2>}

      <div className="card relative flex-1 flex flex-col px-5 py-6" key={`${view.phase}-${view.question?.key ?? view.round?.index ?? ""}`}>
        <PlayerPhase view={view} act={act} now={now} setToast={setToast} teamName={myTeam?.name ?? ""} />
      </div>
      {view.phase === "lobby" && <Mascot mascots={view.mascots} pose="hearts" index={1} className="w-28 mx-auto -mt-6 relative z-10" />}

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
  return <main className="min-h-[100dvh] px-3 pt-4 pb-24 max-w-md mx-auto flex flex-col">{children}</main>;
}

/** Round 1 / 4 · title · question 3 / 10, and a progress bar across the whole game. */
function RoundHeader({ view }: { view: RoomView }) {
  const r = view.round!;
  const q = view.question;
  const pct = view.progress.total ? Math.min(100, (view.progress.done / view.progress.total) * 100) : 0;
  return (
    <div className="text-center pb-4 px-2">
      <p className="font-mono font-semibold uppercase tracking-label text-[15px] leading-tight">
        {q?.kind === "tiebreak" ? "Tie-breaker" : `Round ${r.index + 1} / ${r.total}`}
      </p>
      {q?.kind !== "tiebreak" && <p className="font-mono font-semibold uppercase text-[17px] leading-tight">{r.title}</p>}
      {q?.kind !== "tiebreak" && (
        <p className="font-mono uppercase tracking-label text-[12px] text-dust mt-0.5">
          {q?.bonus ? "Bonus question" : `Question ${Math.max(1, r.qIndex + 1)} / ${r.qCount}`}
        </p>
      )}
      <div className="flex items-center gap-3 mt-3">
        <div className="flex-1 h-3 rounded-full bg-wine/80 overflow-hidden ring-1 ring-bone/20">
          <div className="h-full rounded-full bg-acid transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono text-[12px] uppercase tracking-label">Total: {view.progress.total}</span>
      </div>
    </div>
  );
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
      return <Overview view={view} />;
    case "wager":
      return <Wager view={view} act={act} setToast={setToast} />;
    case "question":
      return <Question view={view} act={act} now={now} setToast={setToast} />;
    case "reveal":
      return <Reveal view={view} />;
    case "unmask":
      return <PhoneUnmask view={view} />;
    case "leaderboard":
      return view.scoresHidden ? (
        <div className="flex-1 flex flex-col justify-center gap-6">
          <p className="label anim-rise">Round {ROMAN[view.round?.index ?? 0]} complete</p>
          <h1 className="display text-5xl anim-rise delay-1">
            The scores are <span className="italic">sealed.</span>
          </h1>
          <p className="text-bone/55 anim-rise delay-2">Everything is being counted. All will be revealed at the end.</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center gap-10">
          <p className="label anim-rise">After round {ROMAN[view.round?.index ?? 0]}</p>
          {view.teamsEnabled ? <Standings teams={view.teams} /> : <Ranking players={view.players} highlight={view.me!.id} />}
        </div>
      );
    case "final":
      return <Final view={view} />;
  }
}

/** Every girl's portrait, marked READY once she has joined. Tappable when choosing your own. */
function PortraitGrid({ view, onPick, mine }: { view: RoomView; onPick?: (id: string) => void; mine?: string }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {view.profiles.map((pr, i) => {
        const taken = !!pr.playerId;
        return (
          <button
            key={pr.id}
            type="button"
            data-profile={pr.id}
            disabled={!onPick || taken}
            onClick={() => onPick?.(pr.id)}
            className="text-left anim-rise disabled:cursor-default"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <Portrait photo={pr.photo} name={pr.name} dim={!taken && !onPick} className={pr.id === mine ? "outline outline-[3px] outline-acid" : ""}>
              <span
                className={`absolute left-1.5 bottom-1.5 font-mono text-[10px] tracking-label px-1.5 py-0.5 ${
                  taken ? "bg-acid text-ink" : "bg-ink/70 text-bone/60"
                }`}
              >
                {taken ? (pr.online ? "READY" : "AWAY") : "WAITING"}
              </span>
            </Portrait>
            <p className={`mt-1 text-sm truncate ${pr.id === mine ? "text-acid" : taken ? "" : "text-bone/45"}`}>{pr.name}</p>
          </button>
        );
      })}
    </div>
  );
}

function Lobby({ view, act, setToast, teamName }: { view: RoomView; act: ActFn; setToast: (s: string) => void; teamName: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const teammates = view.players.filter((p) => p.team === view.me!.team);
  const me = view.me!;
  const myProfile = view.players.find((p) => p.id === me.id)?.profileId;
  const usePortraits = view.profiles.length > 0;

  if (usePortraits && !myProfile)
    return (
      <div className="flex-1 flex flex-col gap-8 pt-4">
        <div>
          <p className="label mb-2">Choose again</p>
          <h1 className="display text-5xl">Tap your own photo.</h1>
        </div>
        <PortraitGrid
          view={view}
          onPick={async (id) => {
            const r = await act({ type: "claim", profileId: id });
            if (!r.ok && r.message) setToast(r.message);
            else sfx.lock();
          }}
        />
      </div>
    );

  return (
    <div className="flex-1 flex flex-col gap-12 pt-4">
      <section>
        <TitleLockup className="anim-rise mb-8" size="clamp(2.6rem, 13vw, 4rem)" />
        {!usePortraits && (
          <div className="mb-8 anim-rise">
            <PhotoPicker
              photo={me.photo}
              name={me.name}
              onPick={async (f) => {
                const r = await act({ type: "photo", photo: await squarePhoto(f) });
                if (!r.ok && r.message) setToast(r.message);
              }}
            />
          </div>
        )}
        <p className="label mb-3 anim-rise">You’re in, {me.name}</p>
        {view.teamsEnabled && (
          <>
            <h1 className="display text-5xl anim-rise delay-1">
              <span className="italic">Team</span> {teamName}
            </h1>
            <p className="mt-3 text-bone/60 anim-rise delay-2">{teammates.map((p) => p.name).join(", ")}</p>
          </>
        )}
        {usePortraits && (
          <div className="mt-4">
            <PortraitGrid view={view} mine={myProfile} />
            <p className="label mt-4">
              {view.profiles.filter((p) => p.playerId).length} of {view.profiles.length} here
            </p>
          </div>
        )}
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
        <span className="label truncate">{q.category ?? (q.kind === "men" ? "Votes are anonymous" : "")}</span>
        <span className="text-2xl">
          <Timer variant="number" deadline={view.deadline} total={q.timerSec} now={now} paused={view.paused} pausedRemaining={view.pausedRemaining} onExpire={() => act({ type: "timeout" })} />
        </span>
      </div>
      <Timer deadline={view.deadline} total={q.timerSec} now={now} paused={view.paused} pausedRemaining={view.pausedRemaining} ticks />
    </>
  );

  if (me.role === "presubmitted")
    return (
      <div className="flex-1 flex flex-col">
        {header}
        <div className="flex-1 flex flex-col justify-center">
          <h1 className="display text-4xl mb-6 text-bone/50">{q.prompt}</h1>
          <p className="display text-5xl italic">Your answer is already sealed.</p>
          <p className="mt-4 text-bone/55">You gave it in advance. Watch them try to read your mind.</p>
        </div>
      </div>
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
        <h1 className={`font-sans font-bold leading-[1.15] tracking-[-0.01em] text-center ${q.prompt.length > 90 ? "text-[1.3rem]" : "text-[1.6rem]"} ${q.kind === "whoSaid" ? "italic" : ""} anim-rise`}>
          {q.kind === "whoSaid" ? `“${q.prompt}”` : q.prompt}
        </h1>
        {q.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={q.image} alt="" className="mt-5 w-full max-h-64 object-cover anim-fade" />
        )}
      </div>

      {q.kind === "men" && q.type === "vote" && (
        <div className="mt-auto">
          <Lineup view={view} chosen={typeof chosen === "number" ? chosen : null} onPick={(i) => submit(i)} disabled={locked || pending !== null} />
        </div>
      )}

      {q.type === "kfm" && <KfmPicker view={view} locked={locked} answer={me.answer as string | null} onSubmit={(v) => submit(v)} />}

      {q.kind !== "men" && (q.type === "mc" || q.type === "vote") && (
        <div className="space-y-2 mt-auto">
          {q.options.map((opt, i) => {
            const active = chosen === i;
            return (
              <button
                key={i}
                data-option={i}
                disabled={locked || pending !== null}
                onClick={() => submit(i)}
                className={`w-full text-left flex items-center gap-3 pl-2 pr-5 py-2 rounded-full border-2 font-semibold transition anim-rise ${
                  active ? "bg-acid text-ink border-acid shadow-md" : locked ? "border-bone/10 text-bone/35" : "border-bone/15 bg-field hover:border-acid/60 active:scale-[0.99]"
                }`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <OptionLetter i={i} active={active} />
                <span className="text-[18px] leading-snug">{opt}</span>
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
                className="field text-2xl font-semibold"
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
    me.role !== "guess" || q.kind === "men" || q.kind === "mostLikely"
      ? null
      : !mine || mine.value === null
        ? "No answer."
        : mine.correct || mine.points > 0
          ? "Correct."
          : "Not quite.";

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
      <div className={`anim-rise delay-2 ${q.kind === "men" && q.type === "vote" ? "hidden" : ""}`}>
        <p className="label mb-2">{q.kind === "men" ? "The room’s choice" : q.kind === "mostLikely" ? "The room has spoken" : "The answer"}</p>
        <p className="display text-4xl">{revealHeadline(view)}</p>
        {r.note && <p className="mt-3 text-bone/55 font-serif italic text-xl">{r.note}</p>}
      </div>
      {q.kind === "men" && q.type === "vote" && <PhoneMenWinner view={view} />}
      {q.kind !== "men" && q.type === "vote" && (
        <div className="anim-rise delay-3">
          <Bars rows={voteRows(view)} highlight={(i) => r.voteWinners?.includes(voteRows(view)[i].label) ?? false} />
        </div>
      )}
      {q.type === "kfm" && <KfmTable reveal={r} />}
      {mine && mine.value !== null && q.type !== "vote" && q.type !== "kfm" && (
        <p className="text-bone/50 text-sm">You said: <span className="font-serif italic text-lg text-bone/80">{mine.display}</span></p>
      )}
    </div>
  );
}

function Final({ view }: { view: RoomView }) {
  if (view.teamsEnabled) {
    const sorted = [...view.teams].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const winner = sorted[0];
    const mine = view.me!.team === winner?.id;
    return (
      <div className="flex-1 flex flex-col justify-center gap-10">
        <TitleLockup size="clamp(2.4rem, 12vw, 3.6rem)" className="anim-rise" />
        {view.tie ? (
          <h1 className="display text-5xl anim-rise delay-1">
            A dead heat. <span className="italic">Tie-breaker incoming.</span>
          </h1>
        ) : (
          <h1 className="display text-5xl anim-rise delay-1">
            <span className="italic">{winner?.name}</span> take it.{mine && <span className="block text-acid text-3xl mt-3">That’s you.</span>}
          </h1>
        )}
        <Standings teams={view.teams} />
        <p className="display text-3xl italic text-bone/70">Happy fortieth, {view.honoree.name}.</p>
      </div>
    );
  }
  const sorted = [...view.players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const n = sorted.length;
  return (
    <div className="flex-1 flex flex-col justify-center gap-8">
      <TitleLockup size="clamp(2.4rem, 12vw, 3.6rem)" className="anim-rise" />
      <p className="label">The final scores</p>
      <Ranking players={view.players} highlight={view.me!.id} />
      {view.tie ? (
        <p className="display text-4xl italic anim-rise" style={{ animationDelay: `${n * 650}ms` }}>
          A dead heat. Tie-breaker incoming.
        </p>
      ) : (
        <p className="display text-4xl anim-rise" style={{ animationDelay: `${n * 650}ms` }}>
          <span className="italic">{sorted[0]?.name}</span> wins.
          {sorted[0]?.id === view.me!.id && <span className="block text-acid text-3xl mt-2">That’s you.</span>}
        </p>
      )}
      <p className="display text-3xl italic text-bone/70 anim-rise" style={{ animationDelay: `${n * 650 + 600}ms` }}>
        Happy fortieth, {view.honoree.name}.
      </p>
    </div>
  );
}

/** Kill / F / Marry: give each of the three men a different fate. */
function KfmPicker({ view, locked, answer, onSubmit }: { view: RoomView; locked: boolean; answer: string | null; onSubmit: (v: string) => void }) {
  const q = view.question!;
  const fates = ["Kill", "Fuck", "Marry"] as const;
  const [picks, setPicks] = useState<(number | null)[]>(() => (answer ? answer.split(",").map(Number) : [null, null, null]));
  const fateOf = (i: number) => picks.findIndex((x) => x === i);
  const ready = picks.every((x) => x !== null);
  return (
    <div className="mt-auto space-y-4">
      {q.options.map((name, i) => {
        const f = fateOf(i);
        return (
          <div key={i} className="flex gap-3 items-center anim-rise" style={{ animationDelay: `${i * 80}ms` }}>
            <Portrait photo={q.optionPhotos?.[i]} name={name} className="w-20 shrink-0" />
            <div className="flex-1">
              <p className="font-serif text-2xl mb-2">{name}</p>
              <div className="flex gap-1.5">
                {fates.map((label, k) => (
                  <button
                    key={label}
                    data-kfm={`${i}-${k}`}
                    disabled={locked}
                    onClick={() => setPicks((p) => p.map((x, j) => (j === k ? i : x === i ? null : x)))}
                    className={`btn-sm border flex-1 ${f === k ? "bg-acid text-ink border-acid" : "border-bone/20 text-bone/70"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })}
      {!locked && (
        <button className="btn-acid w-full py-4" disabled={!ready} onClick={() => onSubmit(picks.join(","))}>
          Seal their fates
        </button>
      )}
    </div>
  );
}

/** The phone follows the big screen through the unmasking. */
function PhoneUnmask({ view }: { view: RoomView }) {
  const u = view.unmask!;
  const card = u.step >= 1 && u.step <= u.total ? u.cards[u.step - 1] : null;
  if (u.step === 0)
    return (
      <div className="flex-1 flex flex-col justify-center">
        <p className="label mb-3">The unmasking</p>
        <h1 className="display text-5xl">
          Who were these men, <span className="italic">really?</span>
        </h1>
      </div>
    );
  if (!card)
    return (
      <div className="flex-1 flex flex-col gap-4 pt-4">
        <p className="label">The full lineup</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-5">
          {u.cards.map((c) => (
            <div key={c.token} className="grid grid-cols-2 gap-1">
              <Portrait photo={c.malePhoto} name={c.maleName} />
              <Portrait photo={c.femalePhoto} name={c.femaleName ?? "?"} />
              <p className="col-span-2 text-sm">
                {c.maleName} <span className="text-bone/40">is</span> <span className="text-acid">{c.femaleName}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  return (
    <div className="flex-1 flex flex-col justify-center gap-6" key={card.token}>
      <p className="label text-center">
        {u.step} of {u.total} · {card.votes} vote{card.votes === 1 ? "" : "s"}
      </p>
      <div className="relative grid grid-cols-2 gap-4">
        <div className="anim-rise">
          <Portrait photo={card.malePhoto} name={card.maleName} />
          <p className="chip text-[15px] px-4 py-1 mt-3 block w-fit mx-auto">{card.maleName}</p>
        </div>
        <div className="anim-unveil">
          <Portrait photo={card.femalePhoto} name={card.femaleName ?? "?"} />
          <p className="chip text-[15px] px-4 py-1 mt-3 block w-fit mx-auto">{card.femaleName}</p>
        </div>
        <Heart className="absolute left-1/2 top-[38%] -translate-x-1/2 w-10 anim-unveil" />
      </div>
    </div>
  );
}

/** The four rounds, with the current one marked. */
function Overview({ view }: { view: RoomView }) {
  const cur = view.round?.index ?? 0;
  return (
    <div className="flex-1 flex flex-col gap-4">
      <h2 className="font-mono font-semibold uppercase text-xl text-center tracking-label">Game overview</h2>
      <ol className="space-y-3">
        {view.roundTitles.map((r, i) => (
          <li
            key={i}
            className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 anim-rise ${i === cur ? "border-acid bg-wine" : "border-bone/10"} ${i < cur ? "opacity-45" : ""}`}
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <span className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-acid text-ink font-mono text-lg font-semibold">{i + 1}</span>
            <span className="flex-1">
              <span className="block font-mono font-semibold uppercase leading-tight">{r.title}</span>
              <span className="block text-xs text-dust uppercase font-mono tracking-label">{i === cur ? "Up now" : i < cur ? "Done" : "Coming up"}</span>
            </span>
          </li>
        ))}
      </ol>
      {view.round && <p className="text-center font-serif italic font-bold text-xl mt-2">{view.round.subtitle}</p>}
      <p className="label text-center anim-pulse mt-auto">Eyes on the big screen</p>
    </div>
  );
}

/** Round 3 result on the phone: the crowned man, his votes, then everyone else. */
function PhoneMenWinner({ view }: { view: RoomView }) {
  const q = view.question!;
  const r = view.reveal!;
  const rows = q.options.map((name, i) => ({ name, n: r.distribution[i] ?? 0, photo: q.optionPhotos?.[i] })).sort((a, b) => b.n - a.n);
  const top = rows[0];
  const max = Math.max(1, top?.n ?? 0);
  return (
    <div className="flex flex-col gap-5">
      {top && top.n > 0 && (
        <div className="relative w-32 mx-auto anim-rise">
          <Crown className="absolute -top-7 left-1/2 -translate-x-1/2 w-16 z-10" />
          <Portrait photo={top.photo} name={top.name} className="ring-4 ring-gold" />
          <p className="chip text-lg px-5 py-1 -mt-4 relative block w-fit mx-auto">{top.name}</p>
          <p className="font-mono text-2xl font-semibold uppercase text-center mt-2">
            {top.n} vote{top.n === 1 ? "" : "s"}
          </p>
        </div>
      )}
      <ul className="space-y-2">
        {rows.map((x, i) => (
          <li key={x.name} className="flex items-center gap-3 anim-rise" style={{ animationDelay: `${300 + i * 80}ms` }}>
            <span className="w-16 text-sm font-semibold truncate">{x.name}</span>
            <span className="flex-1 h-3.5 rounded-full bg-wine overflow-hidden">
              <span className="block h-full rounded-full bg-acid anim-grow" style={{ width: `${(x.n / max) * 100}%`, animationDelay: `${400 + i * 80}ms` }} />
            </span>
            <span className="w-5 text-right font-mono">{x.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
