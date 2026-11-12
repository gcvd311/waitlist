import { TRIVIA_BANK } from "./triviaBank";
import type {
  Answer,
  Content,
  ContentQuestion,
  HostAction,
  Player,
  PlayerAction,
  PublicPlayer,
  PublicTeam,
  RevealData,
  RoomQuestion,
  RoomRound,
  RoomState,
  RoomView,
} from "./types";

export class GameError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const MAX_PLAYERS = 24;
export const ANSWER_GRACE_MS = 1500;
export const ONLINE_WINDOW_MS = 20_000;

// ───────────────────────── small helpers ─────────────────────────

export const uid = (n = 10) => {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  const arr = new Uint32Array(n);
  globalThis.crypto.getRandomValues(arr);
  for (let i = 0; i < n; i++) s += chars[arr[i] % chars.length];
  return s;
};

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const fillName = (text: string, name: string) => text.replace(/\{name\}/g, name);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(the|a|an|her|my)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Lenient match for free-text answers. The host can always override. */
export function textMatches(value: string, answer: string | number | undefined, accept: string[] = []): boolean {
  const v = normalize(String(value));
  if (!v) return false;
  const targets = [answer, ...accept].filter((t) => t !== undefined && String(t).trim() !== "").map((t) => normalize(String(t)));
  return targets.some((t) => {
    if (!t) return false;
    if (v === t) return true;
    if (t.length >= 5 && lev(v, t) <= Math.floor(t.length / 6) + 1) return true;
    if (t.length >= 4 && (v.includes(t) || (v.length >= 4 && t.includes(v) && v.length / t.length > 0.6))) return true;
    return false;
  });
}

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 20);
}

// ───────────────────────── room creation ─────────────────────────

export function createRoomState(code: string, content: Content, now: number): RoomState {
  const rounds: RoomRound[] = content.rounds
    .filter((r) => r.enabled)
    .map((r) => ({
      kind: r.kind,
      title: r.title,
      subtitle: r.subtitle,
      count: r.count,
      timerSec: r.timerSec,
      points: r.points,
      questions: [],
    }));
  return {
    code,
    createdAt: now,
    content,
    players: {},
    confessions: [],
    rounds,
    roundIndex: -1,
    qIndex: -1,
    phase: "lobby",
    current: null,
    deadline: null,
    paused: false,
    pausedRemaining: null,
    answers: {},
    honoreeAnswers: {},
    marks: {},
    wagers: {},
    awards: {},
    teamAwards: {},
    adjustments: [],
    skipped: [],
    tiebreakCount: 0,
    finishedAt: null,
  };
}

// ───────────────────────── building questions ─────────────────────────

const DIFF_MULT = { easy: 1, medium: 1.5, hard: 2 } as const;
const DIFF_ORDER = { easy: 0, medium: 1, hard: 2 } as const;

function shuffleOptions(q: ContentQuestion): { options: string[]; answer?: number } {
  const options = q.options ?? [];
  if (q.type !== "mc" || typeof q.answer !== "number") return { options, answer: q.answer as number | undefined };
  const order = shuffle(options.map((_, i) => i));
  return { options: order.map((i) => options[i]), answer: order.indexOf(q.answer) };
}

function toRoomQ(q: ContentQuestion, round: RoomRound, key: string, name: string, shuffleOpts: boolean): RoomQuestion {
  const { options, answer } = shuffleOpts ? shuffleOptions(q) : { options: q.options ?? [], answer: q.answer };
  return {
    key,
    kind: round.kind,
    type: q.type,
    prompt: fillName(q.prompt, name),
    options: q.type === "mc" ? options.map((o) => fillName(o, name)) : [],
    answer: q.type === "text" && typeof answer === "string" ? fillName(answer, name) : answer,
    accept: q.accept,
    image: q.image || undefined,
    note: q.note ? fillName(q.note, name) : undefined,
    category: q.category,
    difficulty: q.difficulty,
    points: round.kind === "trivia" ? Math.round(round.points * DIFF_MULT[q.difficulty ?? "medium"]) : round.points,
    timerSec: round.timerSec,
    aboutHer: q.aboutHer,
    placeholder: q.placeholder,
  };
}

function usable(q: ContentQuestion): boolean {
  if (!q.prompt?.trim()) return false;
  if ("image" in q && q.image === "") return false; // picture question without a picture yet
  if (q.type === "mc" && (!q.options || q.options.filter(Boolean).length < 2)) return false;
  return true;
}

export function buildRound(state: RoomState, index: number): RoomQuestion[] {
  const round = state.rounds[index];
  const c = state.content;
  const name = c.honoree.name;
  const nonce = uid(4);
  const key = (j: number) => `r${index}q${j}.${nonce}`;
  const players = Object.values(state.players).sort((a, b) => a.joinedAt - b.joinedAt);

  switch (round.kind) {
    case "knowHer":
      return c.questions.knowHer.filter(usable).slice(0, round.count).map((q, j) => toRoomQ(q, round, key(j), name, false));
    case "honoreeVs":
      return c.questions.honoreeVs.filter(usable).slice(0, round.count).map((q, j) => toRoomQ(q, round, key(j), name, false));
    case "final40":
      return c.questions.final40.filter(usable).slice(0, round.count).map((q, j) => toRoomQ(q, round, key(j), name, true));
    case "trivia": {
      const pool = [...c.questions.trivia.filter(usable), ...(c.useBuiltInTrivia ? TRIVIA_BANK : [])];
      const custom = shuffle(c.questions.trivia.filter(usable));
      const rest = shuffle(pool.filter((q) => !custom.includes(q)));
      const picked = [...custom, ...rest].slice(0, round.count);
      picked.sort((a, b) => DIFF_ORDER[a.difficulty ?? "medium"] - DIFF_ORDER[b.difficulty ?? "medium"]);
      return picked.map((q, j) => toRoomQ(q, round, key(j), name, true));
    }
    case "whoSaid": {
      const pool = shuffle([...c.confessions, ...state.confessions].filter((x) => x.text.trim() && x.author.trim()));
      const names: string[] = [];
      const add = (n: string) => {
        const t = n.trim();
        if (t && !names.some((x) => x.toLowerCase() === t.toLowerCase())) names.push(t);
      };
      players.forEach((p) => add(p.name));
      c.guests.forEach(add);
      pool.forEach((x) => add(x.author));
      return pool.slice(0, round.count).map((x, j) => ({
        key: key(j),
        kind: "whoSaid" as const,
        type: "mc" as const,
        prompt: x.text.trim(),
        options: names,
        answer: names.findIndex((n) => n.toLowerCase() === x.author.trim().toLowerCase()),
        points: round.points,
        timerSec: round.timerSec,
      }));
    }
    case "mostLikely":
      return shuffle(c.questions.mostLikely.filter((p) => p.prompt.trim()))
        .slice(0, round.count)
        .map((p, j) => ({
          key: key(j),
          kind: "mostLikely" as const,
          type: "vote" as const,
          prompt: fillName(p.prompt, name),
          options: players.map((pl) => pl.name),
          optionIds: players.map((pl) => pl.id),
          points: round.points,
          timerSec: round.timerSec,
        }));
  }
}

// ───────────────────────── eligibility & scoring ─────────────────────────

export function isEligible(q: RoomQuestion, p: Player): boolean {
  if (!p.isHonoree) return true;
  if (q.kind === "knowHer" || q.kind === "honoreeVs") return false;
  if (q.kind === "final40" && q.aboutHer) return false;
  return true;
}

function honoreeAnswerFor(state: RoomState, q: RoomQuestion): string | number | undefined {
  if (q.kind !== "honoreeVs") return q.answer;
  return state.honoreeAnswers[q.key] ?? q.answer;
}

function autoCorrect(state: RoomState, q: RoomQuestion, value: string | number): boolean {
  const target = honoreeAnswerFor(state, q);
  if (q.type === "mc") return typeof target === "number" && target >= 0 && value === target;
  if (q.type === "text") return typeof value === "string" && textMatches(value, target, q.accept);
  return false;
}

export function isCorrect(state: RoomState, q: RoomQuestion, pid: string, value: string | number): boolean {
  const mark = state.marks[q.key]?.[pid];
  if (mark !== undefined) return mark;
  return autoCorrect(state, q, value);
}

export function computeAwards(state: RoomState, q: RoomQuestion): void {
  const answers = state.answers[q.key] ?? {};
  const awards: Record<string, number> = {};
  const teamAwards: Record<string, number> = {};
  const sc = state.content.scoring;

  if (q.type === "vote") {
    const counts: Record<string, number> = {};
    Object.values(answers).forEach((a) => {
      const id = q.optionIds?.[a.value as number];
      if (id) counts[id] = (counts[id] ?? 0) + 1;
    });
    const max = Math.max(0, ...Object.values(counts));
    // A verdict needs at least two people agreeing; ten different names is no verdict.
    const winners = max >= 2 ? Object.keys(counts).filter((id) => counts[id] === max) : [];
    for (const [pid, a] of Object.entries(answers)) {
      const id = q.optionIds?.[a.value as number];
      if (id && winners.includes(id) && q.points > 0) awards[pid] = q.points;
    }
  } else if (q.type === "number") {
    const target = Number(q.answer);
    const entries = Object.entries(answers).filter(([pid]) => state.players[pid]);
    if (entries.length) {
      const best = Math.min(...entries.map(([, a]) => Math.abs(Number(a.value) - target)));
      const winningTeams = new Set(
        entries.filter(([, a]) => Math.abs(Number(a.value) - target) === best).map(([pid]) => state.players[pid].team),
      );
      winningTeams.forEach((t) => (teamAwards[t] = 10));
    }
  } else if (q.kind === "final40") {
    const wagers = state.wagers[q.key] ?? {};
    state.teamAwards[q.key] = {}; // score before this question, for capping losses

    for (const team of state.content.teams) {
      const members = Object.values(state.players).filter((p) => p.team === team.id && isEligible(q, p));
      const answered = members.filter((p) => answers[p.id]);
      const right = answered.filter((p) => isCorrect(state, q, p.id, answers[p.id].value)).length;
      const w = wagers[team.id] ?? 0;
      const won = answered.length > 0 && right > answered.length / 2;
      // You can only lose what you have: a team at zero can still bet the floor, but not go negative.
      const loss = Math.min(w, Math.max(0, teamScore(state, team.id)));
      if (w > 0) teamAwards[team.id] = won ? w : -loss;
    }
  } else {
    const guessers = Object.keys(answers).filter((pid) => state.players[pid]);
    const right = guessers.filter((pid) => isCorrect(state, q, pid, answers[pid].value));
    const surprise = q.kind === "honoreeVs" && right.length > 0 && right.length <= Math.ceil(guessers.length / 3) && guessers.length >= 3;
    for (const pid of right) {
      let pts = q.points;
      if (q.kind === "trivia") pts += Math.round(sc.speedBonus * Math.max(0, Math.min(1, answers[pid].frac)));
      if (surprise) pts = Math.round(pts * sc.surpriseMultiplier);
      awards[pid] = pts;
    }
  }
  state.awards[q.key] = awards;
  state.teamAwards[q.key] = teamAwards;
}

export function playerScore(state: RoomState, pid: string): number {
  let s = 0;
  for (const k in state.awards) s += state.awards[k][pid] ?? 0;
  for (const a of state.adjustments) if (a.target === "player" && a.targetId === pid) s += a.delta;
  return s;
}

export function teamScore(state: RoomState, tid: string): number {
  let s = 0;
  for (const p of Object.values(state.players)) if (p.team === tid) s += playerScore(state, p.id);
  for (const k in state.teamAwards) s += state.teamAwards[k][tid] ?? 0;
  for (const a of state.adjustments) if (a.target === "team" && a.targetId === tid) s += a.delta;
  return s;
}

export function maxWager(state: RoomState, tid: string): number {
  return Math.max(teamScore(state, tid), state.content.scoring.wagerFloor);
}

// ───────────────────────── flow ─────────────────────────

function startQuestion(state: RoomState, now: number) {
  const q = state.current!;
  state.phase = "question";
  state.paused = false;
  state.pausedRemaining = null;
  state.deadline = q.timerSec > 0 ? now + q.timerSec * 1000 : null;
}

function enterRound(state: RoomState, i: number) {
  state.roundIndex = i;
  state.qIndex = -1;
  state.current = null;
  state.deadline = null;
  state.paused = false;
  state.pausedRemaining = null;
  state.rounds[i].questions = buildRound(state, i);
  state.phase = "round_intro";
}

function gotoQuestion(state: RoomState, j: number, now: number) {
  state.qIndex = j;
  state.current = state.rounds[state.roundIndex].questions[j];
  if (state.current.kind === "final40") {
    state.phase = "wager";
    state.deadline = null;
    state.wagers[state.current.key] = state.wagers[state.current.key] ?? {};
  } else startQuestion(state, now);
}

function afterRound(state: RoomState) {
  state.current = null;
  state.deadline = null;
  state.phase = "leaderboard";
}

function finish(state: RoomState, now: number) {
  state.current = null;
  state.deadline = null;
  state.phase = "final";
  state.finishedAt = state.finishedAt ?? now;
}

function reveal(state: RoomState) {
  const q = state.current;
  if (!q) return;
  computeAwards(state, q);
  state.phase = "reveal";
  state.deadline = null;
  state.paused = false;
  state.pausedRemaining = null;
}

function advance(state: RoomState, now: number) {
  switch (state.phase) {
    case "lobby":
      if (!Object.keys(state.players).length) throw new GameError("Nobody has joined yet.");
      if (!state.rounds.length) throw new GameError("No rounds are enabled. Turn some on in the admin.");
      enterRound(state, 0);
      return;
    case "round_intro": {
      const r = state.rounds[state.roundIndex];
      if (!r.questions.length) return nextRoundOrFinish(state, now);
      gotoQuestion(state, 0, now);
      return;
    }
    case "wager":
      startQuestion(state, now);
      return;
    case "question":
      reveal(state);
      return;
    case "reveal": {
      if (state.current?.kind === "tiebreak") return finish(state, now);
      const r = state.rounds[state.roundIndex];
      if (state.qIndex + 1 < r.questions.length) gotoQuestion(state, state.qIndex + 1, now);
      else afterRound(state);
      return;
    }
    case "leaderboard":
      return nextRoundOrFinish(state, now);
    case "final":
      return;
  }
}

function nextRoundOrFinish(state: RoomState, now: number) {
  if (state.roundIndex + 1 < state.rounds.length) enterRound(state, state.roundIndex + 1);
  else finish(state, now);
}

function clearKeys(state: RoomState, keys: string[]) {
  for (const k of keys) {
    delete state.answers[k];
    delete state.awards[k];
    delete state.teamAwards[k];
    delete state.wagers[k];
    delete state.marks[k];
    delete state.honoreeAnswers[k];
  }
  state.skipped = state.skipped.filter((k) => !keys.includes(k));
}

export function isTie(state: RoomState): boolean {
  const scores = state.content.teams.map((t) => teamScore(state, t.id)).sort((a, b) => b - a);
  return scores.length > 1 && scores[0] === scores[1];
}

function assignTeam(state: RoomState): string {
  const counts = state.content.teams.map((t) => ({ id: t.id, n: Object.values(state.players).filter((p) => p.team === t.id).length }));
  counts.sort((a, b) => a.n - b.n);
  return counts[0].id;
}

// ───────────────────────── public API: join / player / host ─────────────────────────

export function joinRoom(
  state: RoomState,
  rawName: string,
  opts: { now: number; isOnline: (pid: string) => boolean; honoree?: boolean },
): Player {
  const name = cleanName(rawName);
  if (name.length < 1) throw new GameError("Enter a name.");
  const existing = Object.values(state.players).find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    if (opts.isOnline(existing.id)) throw new GameError(`“${existing.name}” is already playing. Try another name, or wait a few seconds if that’s you on another phone.`, 409);
    return existing; // reclaim: same name, previous device has gone quiet
  }
  if (Object.keys(state.players).length >= MAX_PLAYERS) throw new GameError("This room is full.");
  const hasHonoree = Object.values(state.players).some((p) => p.isHonoree);
  const p: Player = {
    id: uid(10),
    secret: uid(16),
    name,
    team: assignTeam(state),
    isHonoree: !!opts.honoree && !hasHonoree,
    joinedAt: opts.now,
  };
  state.players[p.id] = p;
  return p;
}

export function applyPlayerAction(state: RoomState, pid: string, action: PlayerAction, now: number): string | undefined {
  const p = state.players[pid];
  if (!p) throw new GameError("You’re no longer in this room. Rejoin with your name.", 401);

  if (action.type === "confess") {
    const text = String(action.text ?? "").replace(/\s+/g, " ").trim();
    if (text.length < 3) throw new GameError("A little more than that.");
    if (text.length > 280) throw new GameError("Keep it under 280 characters.");
    if (state.confessions.filter((c) => c.author === p.name).length >= 3) throw new GameError("Three confessions is plenty.");
    state.confessions.push({ id: uid(8), author: p.name, text });
    return "Filed. Discreetly.";
  }

  const q = state.current;
  if (!q || action.key !== q.key) throw new GameError("That question has closed.", 409);

  if (action.type === "wager") {
    if (state.phase !== "wager") throw new GameError("Wagers are closed.", 409);
    const amount = Math.round(Number(action.amount));
    const max = maxWager(state, p.team);
    if (!Number.isFinite(amount) || amount < 0 || amount > max) throw new GameError(`Wager between 0 and ${max}.`);
    state.wagers[q.key] = { ...(state.wagers[q.key] ?? {}), [p.team]: amount };
    return;
  }

  // answer
  if (state.phase !== "question") throw new GameError("Answers are closed.", 409);
  if (state.paused) throw new GameError("The game is paused.", 409);
  if (state.deadline && now > state.deadline + ANSWER_GRACE_MS) throw new GameError("Time’s up.", 409);

  let value: string | number = action.value;
  if (q.type === "mc" || q.type === "vote") {
    value = Number(value);
    if (!Number.isInteger(value) || value < 0 || value >= q.options.length) throw new GameError("Pick one of the options.");
  } else if (q.type === "text") {
    value = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
    if (!value) throw new GameError("Type an answer first.");
  } else {
    value = Number(value);
    if (!Number.isFinite(value)) throw new GameError("Enter a number.");
  }

  const frac = state.deadline && q.timerSec ? Math.max(0, Math.min(1, (state.deadline - now) / (q.timerSec * 1000))) : 1;

  if (q.kind === "honoreeVs" && p.isHonoree) {
    if (state.honoreeAnswers[q.key] === undefined) state.honoreeAnswers[q.key] = value;
  } else {
    if (!isEligible(q, p)) throw new GameError("You sit this one out.", 403);
    const bucket = (state.answers[q.key] = state.answers[q.key] ?? {});
    if (bucket[pid]) return "locked"; // duplicate submission: first answer stands
    bucket[pid] = { value, at: now, frac } satisfies Answer;
  }

  if (everyoneAnswered(state)) reveal(state);
  return;
}

export function everyoneAnswered(state: RoomState): boolean {
  const q = state.current;
  if (!q || state.phase !== "question") return false;
  const players = Object.values(state.players);
  const eligible = players.filter((p) => isEligible(q, p));
  if (!eligible.length) return false;
  const answers = state.answers[q.key] ?? {};
  if (!eligible.every((p) => answers[p.id])) return false;
  if (q.kind === "honoreeVs" && players.some((p) => p.isHonoree) && state.honoreeAnswers[q.key] === undefined) return false;
  return true;
}

/** Any client may call this; it only acts if the timer really has run out. */
export function applyTimeout(state: RoomState, now: number): boolean {
  if (state.phase === "question" && !state.paused && state.deadline && now > state.deadline + ANSWER_GRACE_MS) {
    reveal(state);
    return true;
  }
  return false;
}

export function applyHostAction(state: RoomState, action: HostAction, now: number): void {
  switch (action.type) {
    case "start":
      if (state.phase !== "lobby") throw new GameError("Already started.", 409);
      return advance(state, now);
    case "next":
      if (state.paused) throw new GameError("Resume first.", 409);
      return advance(state, now);
    case "reveal":
      if (state.phase === "question") reveal(state);
      return;
    case "skip":
      if ((state.phase === "question" || state.phase === "wager") && state.current) {
        const k = state.current.key;
        clearKeys(state, [k]);
        state.skipped.push(k);
        state.phase = "reveal";
        state.awards[k] = {};
        state.teamAwards[k] = {};
        state.paused = false;
        state.pausedRemaining = null;
      }
      return advance(state, now);
    case "skipRound":
      if (state.phase === "lobby" || state.phase === "final") return;
      if (state.current && (state.phase === "question" || state.phase === "wager")) clearKeys(state, [state.current.key]);
      return nextRoundOrFinish(state, now);
    case "restartRound": {
      if (state.roundIndex < 0 || state.phase === "final") throw new GameError("No round to restart.");
      clearKeys(state, state.rounds[state.roundIndex].questions.map((q) => q.key));
      return enterRound(state, state.roundIndex);
    }
    case "pause":
      if (state.paused) return;
      state.paused = true;
      if (state.phase === "question" && state.deadline) {
        state.pausedRemaining = Math.max(0, state.deadline - now);
        state.deadline = null;
      }
      return;
    case "resume":
      if (!state.paused) return;
      state.paused = false;
      if (state.pausedRemaining !== null) state.deadline = now + state.pausedRemaining;
      state.pausedRemaining = null;
      return;
    case "addTime":
      if (state.phase === "question") {
        const ms = Math.max(5, Math.min(120, action.seconds)) * 1000;
        if (state.deadline) state.deadline = Math.max(state.deadline, now) + ms;
        else if (state.pausedRemaining !== null) state.pausedRemaining += ms;
      }
      return;
    case "mark": {
      const q = state.current;
      if (!q || state.phase !== "reveal") throw new GameError("Marking is only possible on the reveal.", 409);
      state.marks[q.key] = { ...(state.marks[q.key] ?? {}), [action.playerId]: action.correct };
      computeAwards(state, q);
      return;
    }
    case "adjust": {
      const delta = Math.round(Number(action.delta));
      if (!Number.isFinite(delta) || delta === 0) return;
      state.adjustments.push({ id: uid(6), target: action.target, targetId: action.targetId, delta, at: now });
      return;
    }
    case "setTeam":
      if (state.players[action.playerId] && state.content.teams.some((t) => t.id === action.team)) state.players[action.playerId].team = action.team;
      return;
    case "shuffleTeams": {
      const teams = state.content.teams.map((t) => t.id);
      const ps = shuffle(Object.values(state.players));
      ps.sort((a, b) => Number(b.isHonoree) - Number(a.isHonoree));
      ps.forEach((p, i) => (p.team = teams[i % teams.length]));
      return;
    }
    case "setHonoree":
      for (const p of Object.values(state.players)) p.isHonoree = p.id === action.playerId;
      return;
    case "kick":
      delete state.players[action.playerId];
      if (everyoneAnswered(state)) reveal(state);
      return;
    case "tiebreak": {
      if (state.phase !== "final") throw new GameError("Tie-breakers happen at the end.");
      const pool = state.content.questions.tiebreakers.filter((q) => q.prompt.trim() && q.answer !== undefined && q.answer !== "");
      if (!pool.length) throw new GameError("Add a tie-breaker question in the admin.");
      const src = pool[state.tiebreakCount % pool.length];
      state.tiebreakCount++;
      state.current = {
        key: `tb${state.tiebreakCount}.${uid(4)}`,
        kind: "tiebreak",
        type: "number",
        prompt: fillName(src.prompt, state.content.honoree.name),
        options: [],
        answer: Number(src.answer),
        note: src.note,
        points: 10,
        timerSec: 30,
      };
      startQuestion(state, now);
      return;
    }
    case "backToLobby":
      for (const r of state.rounds) clearKeys(state, r.questions.map((q) => q.key)), (r.questions = []);
      Object.assign(state, {
        roundIndex: -1,
        qIndex: -1,
        phase: "lobby",
        current: null,
        deadline: null,
        paused: false,
        pausedRemaining: null,
        answers: {},
        honoreeAnswers: {},
        marks: {},
        wagers: {},
        awards: {},
        teamAwards: {},
        adjustments: [],
        skipped: [],
        tiebreakCount: 0,
        finishedAt: null,
      });
      return;
  }
}

// ───────────────────────── views ─────────────────────────

function displayValue(q: RoomQuestion, v: string | number | undefined | null): string {
  if (v === undefined || v === null || v === "") return "";
  if (q.type === "mc" || q.type === "vote") return q.options[v as number] ?? "";
  return String(v);
}

export function buildReveal(state: RoomState, q: RoomQuestion): RevealData {
  const answers = state.answers[q.key] ?? {};
  const awards = state.awards[q.key] ?? {};
  const teamAwards = state.teamAwards[q.key] ?? {};
  const target = honoreeAnswerFor(state, q);
  const distribution = q.options.map((_, i) => Object.values(answers).filter((a) => a.value === i).length);

  const results = Object.values(state.players)
    .filter((p) => answers[p.id] || isEligible(q, p))
    .filter((p) => !(q.kind === "honoreeVs" && p.isHonoree))
    .map((p) => {
      const a = answers[p.id];
      const correct =
        q.type === "vote" || q.type === "number" ? (awards[p.id] ?? 0) > 0 : a ? isCorrect(state, q, p.id, a.value) : false;
      return {
        playerId: p.id,
        name: p.name,
        team: p.team,
        value: a?.value ?? null,
        display: a ? displayValue(q, a.value) : "",
        correct,
        points: awards[p.id] ?? 0,
      };
    })
    .sort((a, b) => b.points - a.points || Number(b.correct) - Number(a.correct) || a.name.localeCompare(b.name));

  let voteWinners: string[] | undefined;
  if (q.type === "vote") {
    const max = Math.max(0, ...distribution);
    voteWinners = max >= 2 ? q.options.filter((_, i) => distribution[i] === max) : [];
  }

  const right = results.filter((r) => r.correct).length;
  const surprise = q.kind === "honoreeVs" && right > 0 && right <= Math.ceil(results.filter((r) => r.value !== null).length / 3) && results.filter((r) => r.value !== null).length >= 3;

  const correctIndex = (q.type === "mc") && typeof target === "number" && target >= 0 ? target : null;
  const correctText =
    q.type === "mc" ? (correctIndex !== null ? q.options[correctIndex] : null) : q.type === "vote" ? (voteWinners?.join(" & ") || null) : target !== undefined && target !== "" ? String(target) : null;

  return {
    correct: target ?? null,
    correctIndex,
    correctText,
    distribution,
    results,
    teamResults: Object.entries(teamAwards).map(([teamId, points]) => ({ teamId, points })),
    note: q.note,
    surprise,
    voteWinners,
  };
}

export function buildView(
  state: RoomState,
  viewer: { role: "host" } | { role: "player"; pid: string },
  now: number,
  online: Set<string>,
): RoomView {
  const c = state.content;
  const name = c.honoree.name;
  const players: PublicPlayer[] = Object.values(state.players)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => ({ id: p.id, name: p.name, team: p.team, isHonoree: p.isHonoree, online: online.has(p.id), score: playerScore(state, p.id) }));
  const q = state.current;
  const wagers = q ? state.wagers[q.key] : undefined;
  const teams: PublicTeam[] = c.teams.map((t) => ({ id: t.id, name: t.name, score: teamScore(state, t.id), wager: wagers?.[t.id] ?? null, maxWager: maxWager(state, t.id) }));
  const round = state.roundIndex >= 0 && state.rounds[state.roundIndex] ? state.rounds[state.roundIndex] : null;
  const isHost = viewer.role === "host";
  const me = viewer.role === "player" ? state.players[viewer.pid] : undefined;
  const showAnswer = isHost || state.phase === "reveal";

  let question: RoomView["question"] = null;
  if (q) {
    const { answer, accept, ...rest } = q;
    question = showAnswer ? { ...rest, answer, accept } : rest;
  }

  const answers = q ? state.answers[q.key] ?? {} : {};
  let meView: RoomView["me"] = null;
  if (me) {
    const eligible = q ? isEligible(q, me) : true;
    const isHerTurn = !!q && q.kind === "honoreeVs" && me.isHonoree;
    meView = {
      id: me.id,
      name: me.name,
      team: me.team,
      isHonoree: me.isHonoree,
      answer: q ? (isHerTurn ? state.honoreeAnswers[q.key] ?? null : answers[me.id]?.value ?? null) : null,
      eligible: eligible || isHerTurn,
      role: isHerTurn ? "honoree" : eligible ? "guess" : "sitout",
    };
  }

  const view: RoomView = {
    code: state.code,
    serverNow: now,
    role: viewer.role,
    phase: state.phase,
    paused: state.paused,
    deadline: state.deadline,
    pausedRemaining: state.pausedRemaining,
    honoree: { name, tagline: c.honoree.tagline, photos: c.honoree.photos },
    teams,
    players,
    round: round
      ? {
          index: state.roundIndex,
          total: state.rounds.length,
          kind: round.kind,
          title: fillName(round.title, name),
          subtitle: fillName(round.subtitle, name),
          qIndex: state.qIndex,
          qCount: round.questions.length,
        }
      : null,
    roundTitles: state.rounds.map((r) => ({ kind: r.kind, title: fillName(r.title, name) })),
    question,
    answeredIds: Object.keys(answers),
    eligibleIds: q ? Object.values(state.players).filter((p) => isEligible(q, p)).map((p) => p.id) : [],
    reveal: q && state.phase === "reveal" ? buildReveal(state, q) : null,
    me: meView,
    confessionCount: state.confessions.length + c.confessions.length,
    myConfessions: me ? state.confessions.filter((x) => x.author === me.name).length : 0,
    messages: state.phase === "final" || isHost ? c.messages.map((m) => ({ from: m.from, text: m.text })) : [],
    tie: state.phase === "final" && isTie(state),
    isTiebreak: q?.kind === "tiebreak",
    fact: (() => {
      const facts = c.honoree.facts.filter((f) => f.text.trim());
      return state.phase === "leaderboard" && facts.length ? fillName(facts[Math.max(0, state.roundIndex) % facts.length].text, name) : null;
    })(),
  };
  if (isHost && q) {
    view.hostAnswers = Object.fromEntries(Object.entries(answers).map(([pid, a]) => [pid, a.value]));
    view.honoreeAnswered = state.honoreeAnswers[q.key] !== undefined;
    view.placeholderWarning = !!q.placeholder;
  }
  return view;
}
