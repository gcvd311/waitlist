// Plain assertions over the pure engine: a full 10-player game, edge cases included.
import assert from "node:assert/strict";
import { DEFAULT_CONTENT } from "../src/lib/defaultContent";
import { TRIVIA_BANK } from "../src/lib/triviaBank";
import {
  applyHostAction,
  applyPlayerAction,
  applyTimeout,
  buildView,
  createRoomState,
  GameError,
  joinRoom,
  teamScore,
  textMatches,
} from "../src/lib/engine";
import type { RoomState } from "../src/lib/types";

const phase = (st: RoomState): string => st.phase;
let t = 1_000_000;
const now = () => (t += 10);
const online = new Set<string>();
const content = structuredClone(DEFAULT_CONTENT);
content.honoree.name = "Test Honoree";
content.questions.knowHer = content.questions.knowHer.map((q) => (q.type === "text" ? { ...q, answer: "Bookshop", placeholder: false } : q));
content.questions.final40 = content.questions.final40.map((q) => (q.type === "text" ? { ...q, answer: "Lisbon" } : q));
content.confessions = [{ id: "c1", author: "Ana", text: "I have never seen Titanic." }];

const s: RoomState = createRoomState("TEST", content, now());
const names = ["Ana", "Bea", "Cleo", "Dora", "Eva", "Flo", "Gia", "Hana", "Ines", "Jo"];
const ids = names.map((n, i) => joinRoom(s, n, { now: now(), isOnline: (id) => online.has(id), honoree: i === 0 }).id);
ids.forEach((id) => online.add(id));

let pass = 0;
const ok = (cond: unknown, msg: string) => (assert.ok(cond, msg), pass++);

ok(TRIVIA_BANK.length >= 100, "100+ trivia questions");
ok(Object.keys(s.players).length === 10, "10 players joined");
ok(Object.values(s.players).filter((p) => p.team === "cour").length === 5, "teams balanced 5/5");
ok(s.players[ids[0]].isHonoree, "honoree set on join");
assert.throws(() => joinRoom(s, "bea", { now: now(), isOnline: (id) => online.has(id) }), GameError);
pass++;
online.delete(ids[1]);
ok(joinRoom(s, "BEA", { now: now(), isOnline: (id) => online.has(id) }).id === ids[1], "offline player reclaims seat by name");
online.add(ids[1]);
applyPlayerAction(s, ids[2], { type: "confess", text: "I still own a Tamagotchi." }, now());

applyHostAction(s, { type: "start" }, now());
ok(s.phase === "round_intro" && s.rounds[0].kind === "knowHer", "round 1 intro");
ok(!s.rounds[0].questions.some((q) => q.image === ""), "picture placeholder without image skipped");

let guard = 0;
while (s.phase !== "final" && guard++ < 400) {
  if (s.phase === "round_intro" || s.phase === "leaderboard" || s.phase === "reveal") {
    applyHostAction(s, { type: "next" }, now());
    continue;
  }
  const q = s.current!;
  if (s.phase === "wager") {
    applyPlayerAction(s, ids[1], { type: "wager", key: q.key, amount: 100 }, now());
    assert.throws(() => applyPlayerAction(s, ids[2], { type: "wager", key: q.key, amount: 999999 }, now()), GameError);
    applyHostAction(s, { type: "next" }, now());
    continue;
  }
  // question phase
  const before = s.phase;
  ids.forEach((pid, i) => {
    const p = s.players[pid];
    const answer = q.type === "text" ? (i % 2 ? "bookshop " : "no idea") : q.type === "number" ? 2000 + i : i % Math.max(1, q.options.length);
    try {
      applyPlayerAction(s, pid, { type: "answer", key: q.key, value: answer }, now());
    } catch (e) {
      // honoree sits some out
      assert.ok(e instanceof GameError && p.isHonoree, `unexpected rejection: ${(e as Error).message}`);
    }
  });
  if (s.phase === "question") {
    // e.g. nobody eligible; move on via the host
    applyHostAction(s, { type: "reveal" }, now());
  }
  ok(phase(s) === "reveal", `auto-reveal after all answered (${q.kind}, was ${before})`);
  // duplicates after reveal are rejected, not double counted
  assert.throws(() => applyPlayerAction(s, ids[3], { type: "answer", key: q.key, value: 0 }, now()), GameError);
  const v = buildView(s, { role: "player", pid: ids[4] }, now(), online);
  ok(v.reveal !== null, "player sees reveal");
}
ok(s.phase === "final", "reached the final");
const view = buildView(s, { role: "host" }, now(), online);
ok(view.teams.length === 2, "final standings");
ok(view.teams.every((x) => x.score >= 0), "wager losses never push a team below zero");
console.log("scores:", view.teams.map((x) => `${x.name} ${x.score}`).join(" / "));

// Duplicate submission during a question is idempotent
const s2 = createRoomState("DUPE", content, now());
const a = joinRoom(s2, "A", { now: now(), isOnline: () => false });
const b = joinRoom(s2, "B", { now: now(), isOnline: () => false });
s2.rounds = s2.rounds.filter((r) => r.kind === "trivia");
applyHostAction(s2, { type: "start" }, now());
applyHostAction(s2, { type: "next" }, now());
const k = s2.current!.key;
applyPlayerAction(s2, a.id, { type: "answer", key: k, value: s2.current!.answer as number }, now());
ok(applyPlayerAction(s2, a.id, { type: "answer", key: k, value: 0 }, now()) === "locked", "duplicate submission ignored");
ok(s2.phase === "question", "waits for B");

// Pause freezes the clock; timeout only fires after the deadline
applyHostAction(s2, { type: "pause" }, now());
ok(s2.deadline === null && s2.pausedRemaining! > 0, "pause stores remaining time");
assert.throws(() => applyPlayerAction(s2, b.id, { type: "answer", key: k, value: 0 }, now()), GameError);
applyHostAction(s2, { type: "resume" }, now());
ok(!applyTimeout(s2, now()), "no early timeout");
t = s2.deadline! + 5000;
ok(applyTimeout(s2, now()), "timeout reveals");
ok(s2.phase === "reveal" && (s2.awards[k][a.id] ?? 0) >= 100, "A scored with speed bonus");

// Restart round wipes its points
applyHostAction(s2, { type: "restartRound" }, now());
ok(teamScore(s2, a.team) === 0 && s2.phase === "round_intro", "restart round clears points");

// Tie-breaker
const s3 = createRoomState("TIE", content, now());
const x = joinRoom(s3, "X", { now: now(), isOnline: () => false });
const y = joinRoom(s3, "Y", { now: now(), isOnline: () => false });
ok(x.team !== y.team, "split teams");
s3.phase = "final";
ok(buildView(s3, { role: "host" }, now(), new Set()).tie, "tie detected");
applyHostAction(s3, { type: "tiebreak" }, now());
applyPlayerAction(s3, x.id, { type: "answer", key: s3.current!.key, value: 2007 }, now());
applyPlayerAction(s3, y.id, { type: "answer", key: s3.current!.key, value: 1999 }, now());
ok(phase(s3) === "reveal", "tiebreak revealed");
ok(teamScore(s3, x.team) > teamScore(s3, y.team), "closest wins");
applyHostAction(s3, { type: "next" }, now());
ok(s3.phase === "final" && !buildView(s3, { role: "host" }, now(), new Set()).tie, "tie resolved");

// Players never see answers before the reveal
const s4 = createRoomState("HIDE", content, now());
const p4 = joinRoom(s4, "P", { now: now(), isOnline: () => false });
joinRoom(s4, "Q", { now: now(), isOnline: () => false });
s4.rounds = s4.rounds.filter((r) => r.kind === "trivia");
applyHostAction(s4, { type: "start" }, now());
applyHostAction(s4, { type: "next" }, now());
ok(buildView(s4, { role: "player", pid: p4.id }, now(), new Set()).question!.answer === undefined, "answer hidden from players");

ok(textMatches("a bookshop", "Bookshop"), "lenient text match");
ok(textMatches("Bookshp", "Bookshop"), "typo tolerated");
ok(!textMatches("bank", "Bookshop"), "wrong text rejected");

console.log(`engine: ${pass} checks passed`);
