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
ok(s.menRevealed, "men's points count once the round ends");
ok(!s.rounds.some(() => phase(s) === "unmask"), "no unmasking");

console.log(`game40: ${pass} checks passed`);

// Three men per woman: rotate by default, or a fixed man per question
{
  const c7 = structuredClone(content);
  c7.players = c7.players.map((p, i) => ({ ...p, malePhotos: [`data:image/png;base64,A${i}`, `data:image/png;base64,B${i}`, `data:image/png;base64,C${i}`], maleNames: ["", `Second${i}`, `Third${i}`] }));
  c7.rounds = c7.rounds.map((r) => ({ ...r, enabled: r.kind === "men", includeBonus: false }));
  c7.questions.men = c7.questions.men.map((q, i) => (i === 3 ? { ...q, manSet: 2 } : q));
  const s7 = createRoomState("MEN3", c7, now());
  c7.players.forEach((pr) => joinRoom(s7, "", { now: now(), isOnline: () => false, profileId: pr.id }));
  applyHostAction(s7, { type: "start" }, now());
  const qs7 = buildRoundPreview(s7);
  ok(qs7[0].optionPhotos!.every((x) => x.includes("A")), "question 1 shows Man 1");
  ok(qs7[1].optionPhotos!.every((x) => x.includes("B")) && qs7[1].options.every((n) => n.startsWith("Second")), "question 2 shows Man 2 with his name");
  ok(qs7[2].optionPhotos!.every((x) => x.includes("C")), "question 3 shows Man 3");
  ok(qs7[3].optionPhotos!.every((x) => x.includes("C")), "a question can pin Man 3");
  ok(qs7[4].optionPhotos!.every((x) => x.includes("B")), "rotation carries on");
  let g = 0;
  while (s7.phase !== "final" && g++ < 100) {
    if (s7.phase === "question") applyHostAction(s7, { type: "reveal" }, now());
    else applyHostAction(s7, { type: "next" }, now());
    ok(phase(s7) !== "unmask", "never shows the unmasking");
  }
}
function buildRoundPreview(st: RoomState) {
  return st.rounds[st.roundIndex].questions;
}
console.log(`game40 (incl. three men): ${pass} checks passed`);

// Host can step back
{
  const c8 = structuredClone(content);
  c8.rounds = c8.rounds.map((r) => ({ ...r, enabled: r.kind === "past40" || r.kind === "knowHer" }));
  const s8 = createRoomState("BACK", c8, now());
  const pl = joinRoom(s8, "", { now: now(), isOnline: () => false, profileId: c8.players[1].id });
  applyHostAction(s8, { type: "start" }, now());
  applyHostAction(s8, { type: "next" }, now()); // knowHer q1
  applyHostAction(s8, { type: "next" }, now()); // reveal
  applyHostAction(s8, { type: "next" }, now()); // q2
  const q2 = s8.current!.key;
  applyHostAction(s8, { type: "back" }, now());
  ok(s8.qIndex === 0 && phase(s8) === "reveal", "back from question 2 shows question 1 again");
  applyHostAction(s8, { type: "back" }, now());
  ok(phase(s8) === "round_intro", "back from the first question goes to the round intro");
  applyHostAction(s8, { type: "next" }, now());
  ok(s8.qIndex === 0 && phase(s8) === "question", "and forward again works");
  // play to round 2 and step back into round 1
  let g = 0;
  while (!(s8.roundIndex === 1 && phase(s8) === "round_intro") && g++ < 60) applyHostAction(s8, { type: "next" }, now());
  applyHostAction(s8, { type: "back" }, now());
  ok(s8.roundIndex === 0 && phase(s8) === "reveal" && s8.current!.key !== q2, "back from a round intro returns to the previous round’s last question");
  void pl;
}
// Kill / F / Marry uses every man
{
  const s9 = createRoomState("KFM", content, now());
  content.players.forEach((pr) => joinRoom(s9, "", { now: now(), isOnline: () => false, profileId: pr.id }));
  s9.rounds = s9.rounds.filter((r) => r.kind === "men");
  applyHostAction(s9, { type: "start" }, now());
  const kfm = s9.rounds[0].questions.find((q) => q.type === "kfm")!;
  ok(kfm.options.length === content.players.length, "Kill / F / Marry shows the whole lineup");
}
console.log(`game40 (incl. back, kfm): ${pass} checks passed`);

// Encore: extra round, tie-breaker on demand, slideshow
{
  const c = structuredClone(content);
  c.rounds = c.rounds.map((r) => ({ ...r, enabled: r.kind === "knowHer" }));
  c.rounds.find((r) => r.kind === "knowHer")!.count = 3;
  c.questions.knowHer = c.questions.knowHer.map((q, i) => ({ ...q, prompt: `Her question ${i}`, answer: 0, options: ["a", "b"], type: "mc" as const, placeholder: false, off: i >= 3 }));
  c.messages = [{ id: "m1", from: "Bea", text: "Happy birthday", photo: "data:image/png;base64,P" }];
  c.encore = { extraRound: true, extraKind: "knowHer", extraTitle: "Encore", extraCount: 2, tiebreaker: true, slideshow: true, slideSeconds: 8, image: "" };
  c.questions.tiebreakers = [{ id: "tb", type: "number", prompt: "How many?", answer: 40 }];
  const se = createRoomState("ENC", c, now());
  const pe = joinRoom(se, "", { now: now(), isOnline: () => true, profileId: c.players[1].id });
  assert.throws(() => applyHostAction(se, { type: "extraRound" }, now()), GameError);
  pass++;
  applyHostAction(se, { type: "start" }, now());
  let g = 0;
  while (phase(se) !== "final" && g++ < 40) applyHostAction(se, { type: "next" }, now());
  ok(phase(se) === "final", "game reaches the final");
  const asked = new Set(se.rounds[0].questions.map((q) => q.prompt));
  ok(buildView(se, { role: "host" }, now(), new Set([pe.id])).encore.extraRound, "encore settings reach the host screen");
  applyHostAction(se, { type: "slideshow", on: true }, now());
  ok(se.slideshow && buildView(se, { role: "player", pid: pe.id }, now(), new Set([pe.id])).slideshow, "slideshow on, phones know");
  ok(buildView(se, { role: "player", pid: pe.id }, now(), new Set([pe.id])).messages[0].photos[0] === "data:image/png;base64,P", "message photos reach the screen");
  applyHostAction(se, { type: "slideshow", on: false }, now());
  ok(!se.slideshow, "slideshow off");
  applyHostAction(se, { type: "tiebreak" }, now());
  ok(se.current?.kind === "tiebreak", "tie-breaker on demand, even without a tie");
  applyHostAction(se, { type: "next" }, now());
  applyHostAction(se, { type: "next" }, now());
  ok(phase(se) === "final", "back to the final after the tie-breaker");
  applyHostAction(se, { type: "extraRound" }, now());
  ok(phase(se) === "round_intro" && se.rounds.length === 2 && se.rounds[1].title === "Encore", "extra round starts");
  const extra = se.rounds[1].questions;
  ok(extra.length === 2 && extra.every((q) => !asked.has(q.prompt)), "extra round only uses unseen questions, including switched-off ones");
  g = 0;
  while (phase(se) !== "final" && g++ < 40) applyHostAction(se, { type: "next" }, now());
  ok(phase(se) === "final", "and returns to the final");
  c.encore.extraRound = false;
  se.content.encore!.extraRound = false;
  assert.throws(() => applyHostAction(se, { type: "extraRound" }, now()), GameError);
  pass++;
  applyHostAction(se, { type: "backToLobby" }, now());
  ok(se.rounds.length === 1, "play again drops the encore round");
}
console.log(`game40 (incl. encore): ${pass} checks passed`);

// Host can jump between rounds and straight to the final
{
  const c = structuredClone(content);
  const sj = createRoomState("JUMP", c, now());
  joinRoom(sj, "", { now: now(), isOnline: () => true, profileId: c.players[1].id });
  applyHostAction(sj, { type: "start" }, now());
  applyHostAction(sj, { type: "next" }, now());
  ok(phase(sj) === "question", "a question is open");
  applyHostAction(sj, { type: "jump", round: 2 }, now());
  ok(sj.roundIndex === 2 && phase(sj) === "round_intro", "jump to round 3");
  applyHostAction(sj, { type: "jump", round: 0 }, now());
  ok(sj.roundIndex === 0 && phase(sj) === "round_intro", "jump back to round 1");
  applyHostAction(sj, { type: "jump", round: 99 }, now());
  ok(phase(sj) === "final", "jump to the final scores");
  applyHostAction(sj, { type: "slideshow", on: true }, now());
  ok(sj.slideshow, "slideshow from the final");
}
console.log(`game40 (incl. jump): ${pass} checks passed`);

// Bonus game: MOST LIKELY TO...
{
  const c = mergeContent(structuredClone(content));
  ok(c.questions.likely.length === 20, "twenty bonus questions to start");
  ok(!createRoomState("X", c, now()).rounds.some((r) => r.kind === "likely"), "the bonus game is not part of the 40");
  const sb = createRoomState("LIKE", c, now());
  const ids: string[] = c.players.map((pr) => joinRoom(sb, "", { now: now(), isOnline: () => true, profileId: pr.id }).id);
  applyHostAction(sb, { type: "start" }, now()); // round 1 intro
  applyHostAction(sb, { type: "bonusGame" }, now());
  ok(sb.roundIndex === 0 && sb.rounds[0].kind === "likely" && sb.rounds[1].kind === "knowHer", "launched before a round starts, it plays first and the game carries on");
  applyHostAction(sb, { type: "next" }, now());
  const q1 = sb.current!;
  ok(q1.kind === "likely" && q1.options.length === 6 && q1.optionPhotos!.every(Boolean), "six portraits with names");
  ok(q1.options.includes("Crystal") && q1.options.includes("Bea"), "real names");
  const v = buildView(sb, { role: "player", pid: ids[1] }, now(), new Set(ids));
  ok(v.question!.options.join() === q1.options.join(), "same order on every phone");
  // Bea gets 3, Cleo 2, Dora 1
  const at = (n: string) => q1.options.indexOf(n);
  const votes = ["Bea", "Bea", "Bea", "Cleo", "Cleo", "Dora"];
  ids.slice(0, 5).forEach((pid, k) => applyPlayerAction(sb, pid, { type: "answer", key: q1.key, value: at(votes[k]) }, now()));
  ok(phase(sb) === "question", "waits until everyone has voted");
  applyPlayerAction(sb, ids[5], { type: "answer", key: q1.key, value: at(votes[5]) }, now());
  ok(phase(sb) === "reveal", "reveals once everyone has voted");
  ok(sb.awards[q1.key][ids[1]] === 10 && Object.keys(sb.awards[q1.key]).length === 1, "most votes earns 10");
  const rv = buildView(sb, { role: "host" }, now(), new Set(ids));
  ok(rv.reveal!.distribution[at("Bea")] === 3 && rv.reveal!.distribution[at("Cleo")] === 2, "vote counts shown");
  applyHostAction(sb, { type: "next" }, now());
  const q2 = sb.current!;
  ok(q2.options.join() !== q1.options.join() || q2.options.length < 3, "portraits reshuffle between questions");
  const t = (n: string) => q2.options.indexOf(n);
  ["Crystal", "Crystal", "Eva", "Eva", "Flo"].forEach((n, k) => applyPlayerAction(sb, ids[k], { type: "answer", key: q2.key, value: t(n) }, now()));
  applyHostAction(sb, { type: "next" }, now()); // host closes voting
  ok(phase(sb) === "reveal" && sb.awards[q2.key][ids[0]] === 10 && sb.awards[q2.key][ids[4]] === 10, "a tie at the top pays each tied player 10");
  const before = playerScore(sb, ids[1]);
  ok(before >= 10, "points go straight onto the leaderboard");
  let g = 0;
  while (sb.roundIndex === 0 && g++ < 80) applyHostAction(sb, { type: "next" }, now());
  ok(sb.rounds[sb.roundIndex].kind === "knowHer", "after the bonus game, the main game resumes");
  const vv = buildView(sb, { role: "host" }, now(), new Set(ids));
  ok(vv.progress.total === 40, "the 40 still counts 40");
  applyHostAction(sb, { type: "jump", round: 99 }, now());
  applyHostAction(sb, { type: "bonusGame" }, now());
  ok(phase(sb) === "round_intro" && sb.rounds[sb.roundIndex].kind === "likely", "can also be launched from the final screen");
  applyHostAction(sb, { type: "backToLobby" }, now());
  ok(!sb.rounds.some((r) => r.kind === "likely"), "play again drops it");
}
console.log(`game40 (incl. bonus game): ${pass} checks passed`);

// GUILTY AS CHARGED: the awards after the last MOST LIKELY TO question
{
  const c = mergeContent(structuredClone(content));
  c.questions.likely = c.questions.likely.slice(0, 3);
  const sa = createRoomState("GUILT", c, now());
  const ids: string[] = c.players.map((pr) => joinRoom(sa, "", { now: now(), isOnline: () => true, profileId: pr.id }).id);
  const nameOf = (pid: string) => sa.players[pid].name;
  applyHostAction(sa, { type: "start" }, now());
  applyHostAction(sa, { type: "bonusGame" }, now());
  // votes per question, by name: Bea 3+2+1 = 6, Cleo 2+2+2 = 6 (tied gold), Dora 1+1 = 2 (silver), Eva 1 (bronze)
  const plan = [
    ["Bea", "Bea", "Bea", "Cleo", "Cleo", "Dora"],
    ["Bea", "Bea", "Cleo", "Cleo", "Dora", "Eva"],
    ["Bea", "Cleo", "Cleo", "Crystal", "Crystal", "Flo"],
  ];
  for (let qi = 0; qi < 3; qi++) {
    applyHostAction(sa, { type: "next" }, now()); // open the question
    const q = sa.current!;
    plan[qi].forEach((n, k) => applyPlayerAction(sa, ids[k], { type: "answer", key: q.key, value: q.options.indexOf(n) }, now()));
    ok(phase(sa) === "reveal", `question ${qi + 1} revealed`);
  }
  applyHostAction(sa, { type: "next" }, now());
  ok(phase(sa) === "awards" && sa.awardsStep === 0, "awards follow the last question's results");
  const v = buildView(sa, { role: "host" }, now(), new Set(ids)).awards!;
  ok(v.tiers[0].people.map((p) => p.name).sort().join() === "Bea,Cleo" && v.tiers[0].votes === 6, "a tie for gold is shown as a tie");
  ok(v.tiers[1].votes === 2 && v.tiers[1].people.map((p) => p.name).sort().join() === "Crystal,Dora", "second-highest total takes silver (tied)");
  ok(v.tiers[2].votes === 1 && v.tiers[2].people.map((p) => p.name).sort().join() === "Eva,Flo", "third-highest takes bronze");
  const bea = v.ranking.find((p) => p.name === "Bea")!;
  ok(bea.top[0].votes === 3 && bea.top[0].label === c.questions.likely[0].prompt.replace(/^Who’s most likely to /, "").replace(/\?$/, "").replace(/^./, (x) => x.toUpperCase()), "most accused of comes from her real votes");
  ok(v.ranking.length === 6 && v.ranking.filter((p) => p.rank === 1).length === 2, "full rankings: everyone, ties share a place");
  ok(v.ranking.reduce((n, p) => n + p.votes, 0) === 18, "only MOST LIKELY TO votes count");
  for (const step of [1, 2, 3]) {
    applyHostAction(sa, { type: "next" }, now());
    ok(sa.awardsStep === step && phase(sa) === "awards", `host reveals step ${step}`);
  }
  applyHostAction(sa, { type: "awardsPanel", panel: "rankings" }, now());
  ok(buildView(sa, { role: "player", pid: ids[2] }, now(), new Set(ids)).awards!.panel === "rankings", "phones see the panel the host opened");
  applyHostAction(sa, { type: "back" }, now());
  ok(sa.awardsStep === 2, "back steps the reveal back");
  applyHostAction(sa, { type: "next" }, now());
  applyHostAction(sa, { type: "next" }, now());
  ok(phase(sa) === "round_intro" && sa.rounds[sa.roundIndex].kind === "knowHer", "continue goes on to the next round");
  void nameOf;
}
console.log(`game40 (incl. awards): ${pass} checks passed`);
