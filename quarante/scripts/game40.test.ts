// The 40 & Questionable game: portraits, the men's round, the unmasking, sealed scores.
import assert from "node:assert/strict";
import { DEFAULT_CONTENT } from "../src/lib/defaultContent";
import { mergeContent } from "../src/lib/contentMerge";
import { applyHostAction, applyPlayerAction, buildView, createRoomState, GameError, joinRoom, playerScore } from "../src/lib/engine";
import type { RoomState } from "../src/lib/types";

let pass = 0;
const ok = (c: unknown, m: string) => (assert.ok(c, m), pass++);
let t = 5_000_000;
const now = () => (t += 10);
const phase = (s: RoomState): string => s.phase;

const content = structuredClone(DEFAULT_CONTENT);
content.players = content.players.map((p, i) => ({ ...p, name: ["Crystal", "Bea", "Cleo", "Dora", "Eva", "Flo"][i], photo: `data:image/png;base64,F${i}`, malePhotos: [`data:image/png;base64,M${i}a`, `data:image/png;base64,M${i}b`] }));
content.confessions = [
  { id: "c1", author: "Bea", text: "I have never seen Titanic." },
  { id: "c2", author: "Cleo", text: "I still have my Tamagotchi." },
  { id: "c3", author: "Dora", text: "I once lied about my age, upwards." },
];
// Fill the placeholder answers so nothing blocks the run.
content.questions.finale = content.questions.finale.map((q) => (q.optionsFrom && !q.fromPool ? { ...q, answer: "Bea" } : q));

// ── Defaults: four rounds of ten
const enabled = content.rounds.filter((r) => r.enabled);
ok(enabled.length === 4 && enabled.every((r) => r.count === 10), "four rounds of ten by default");
ok(enabled.map((r) => r.kind).join() === "knowHer,past40,men,finale", "Crystal Clear, Past 40, Men, No Further Questions");
ok(content.questions.past40.length >= 40 && content.questions.past40.filter((q) => !q.off).length === 10, "a large Past 40 bank with ten switched on");
const years = content.questions.past40.map((q) => q.year!);
ok(years.every((y, i) => i === 0 || y >= years[i - 1]) && years[0] === 1986, "Past 40 runs in order from 1986");
ok(content.questions.men.filter((q) => !q.bonus).length === 10 && content.questions.men.some((q) => q.type === "kfm" && q.bonus), "ten men's questions plus a K/F/M bonus");
ok(content.honoree.name === "Crystal", "the birthday girl is Crystal");

// ── Migration keeps old edits
const old = { ...structuredClone(DEFAULT_CONTENT), schemaVersion: 1, rounds: [{ kind: "trivia", enabled: true, title: "x", subtitle: "", count: 12, timerSec: 20, points: 100 }] } as never;
const migrated = mergeContent(old);
ok(migrated.rounds.filter((r) => r.enabled).length === 4 && migrated.schemaVersion === 2, "old saves are upgraded to the four-round game");
ok(migrated.questions.knowHer.some((q) => q.id === "9s4kqa"), "her draft question survives");

// ── Lobby: portraits
const s = createRoomState("FORTY", content, now());
const online = new Set<string>();
const isOnline = (id: string) => online.has(id);
const ids: string[] = [];
content.players.forEach((pr) => {
  const p = joinRoom(s, "", { now: now(), isOnline, profileId: pr.id });
  ids.push(p.id);
  online.add(p.id);
});
ok(Object.keys(s.players).length === 6 && s.players[ids[0]].name === "Crystal", "six girls join by tapping their portraits");
ok(s.players[ids[0]].isHonoree, "Crystal's portrait makes her the birthday girl");
assert.throws(() => joinRoom(s, "Impostor", { now: now(), isOnline, profileId: content.players[1].id }), GameError);
pass++;
online.delete(ids[1]);
ok(joinRoom(s, "Bea", { now: now(), isOnline, profileId: content.players[1].id }).id === ids[1], "a quiet phone's portrait can be reclaimed, same identity");
online.add(ids[1]);
applyHostAction(s, { type: "release", playerId: ids[2] }, now());
ok(!s.players[ids[2]].profileId, "host can unlock a portrait");
applyPlayerAction(s, ids[2], { type: "claim", profileId: content.players[2].id }, now());
assert.throws(() => applyPlayerAction(s, ids[3], { type: "claim", profileId: content.players[2].id }, now()), GameError);
pass++;
const lobby = buildView(s, { role: "player", pid: ids[3] }, now(), online);
ok(lobby.profiles.length === 6 && lobby.profiles.every((p) => p.playerId), "everyone sees who is ready");
ok(!JSON.stringify(lobby).includes("Chad") && !JSON.stringify(lobby).includes("M0a"), "the men are nowhere in the lobby");

// ── Play the whole game
applyHostAction(s, { type: "start" }, now());
let questions = 0;
let menSeen = 0;
const orders: string[] = [];
let guard = 0;
while (s.phase !== "final" && guard++ < 500) {
  const ph = phase(s);
  if (ph === "question") {
    const q = s.current!;
    questions++;
    if (q.kind === "men") {
      menSeen++;
      orders.push(q.options.join("|"));
      for (const pid of ids) {
        const v = buildView(s, { role: "player", pid }, now(), online);
        const json = JSON.stringify(v);
        ok(!s.cast.some((m) => json.includes(m.token)) && !content.players.slice(1).some((p) => json.includes(`"${p.id}"`) && json.includes(p.maleName + '"' + "," + '"profileId')), `no identity mapping on a phone (${q.prompt.slice(0, 20)})`);
      }
      const host = JSON.stringify(buildView(s, { role: "host" }, now(), online));
      ok(!s.cast.some((m) => host.includes(m.token)), "no identity mapping on the shared screen");
    }
    ids.forEach((pid, i) => {
      const value = q.type === "kfm" ? "0,1,2" : q.type === "text" ? "no idea" : q.type === "number" ? 14000 + i * 300 : q.kind === "men" ? 0 : i % Math.max(1, q.options.length);
      try {
        applyPlayerAction(s, pid, { type: "answer", key: q.key, value }, now());
      } catch (e) {
        assert.ok(e instanceof GameError, String(e));
      }
    });
    ok(phase(s) === "question", "nothing reveals until the host says so");
    const mid = buildView(s, { role: "player", pid: ids[1] }, now(), online);
    ok(mid.players.every((p) => p.score === null), "scores are sealed during the game");
    applyHostAction(s, { type: "next" }, now());
    ok(phase(s) === "reveal", "host reveals");
    if (q.kind === "men" && q.type === "vote") {
      const r = buildView(s, { role: "player", pid: ids[3] }, now(), online).reveal!;
      ok(r.distribution[0] === 6 && r.voteWinners?.[0] === q.options[0], "votes counted, winner highlighted");
      ok(r.results.every((x) => x.playerId === ids[3]), "votes stay anonymous");
    }
    continue;
  }
  if (ph === "unmask") {
    const u = buildView(s, { role: "player", pid: ids[0] }, now(), online).unmask!;
    ok(u.cards.filter((c) => c.femaleName).length === Math.min(u.step, u.total), `only turned cards carry a name (step ${u.step})`);
    if (u.step === 0) ok(Object.values(s.players).every((p) => playerScore(s, p.id) === playerScore(s, p.id)), "unmask begins");
  }
  applyHostAction(s, { type: "next" }, now());
}
ok(phase(s) === "final", "the game reaches the final");
console.log("menSeen", menSeen, "questions", questions, s.rounds.map((r) => `${r.kind}:${r.questions.length}`).join(" "));
ok(menSeen === 11, "ten men’s questions plus the bonus");
ok(new Set(orders).size > 1, "the lineup changes order between questions");
ok(questions >= 40, `forty questions or more (${questions})`);
const fin = buildView(s, { role: "player", pid: ids[1] }, now(), online);
ok(fin.players.every((p) => typeof p.score === "number"), "scores revealed at the end");
const chad = s.cast.find((m) => m.maleName === "Chad")!;
const crystal = Object.values(s.players).find((p) => p.profileId === chad.profileId)!;
ok(crystal.name === "Crystal", "Chad was Crystal all along");
ok(s.menRevealed, "men's points released after the unmasking");

console.log(`game40: ${pass} checks passed`);
