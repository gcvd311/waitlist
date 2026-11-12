# 40 & Questionable: design notes

> Update: the game is now **40 & Questionable**, four rounds of ten (Crystal Clear?, The Past 40 Years, The Men of Questionable Taste, No Further Questions), individual scoring sealed until the end, portrait-based joining, and a server-protected men’s round with an unmasking. The sections below describe the engine those rounds run on; the README has the current structure.

# Original design notes

## 1. Concept

*Quarante* is French for forty. The game looks like a private magazine issue more than a game show: oversized serif questions, mono labels, a near-black claret ground, one acid-chartreuse accent. No confetti, no cartoons, no casino gold. The cheek is in the copy: “Secret ballot. Public consequences.” “You know this one. Obviously.”

Teams are **Côté Cour** and **Côté Jardin**, the theatre terms for the two sides of a stage. Rename them in the admin.

The arc is built for one evening:

1. **Warm-up about her**: everyone is equal and the stakes are affectionate.
2. **General trivia** opens it up; the speed bonus adds pace.
3. **Who Said That?** turns the room on itself, with confessions collected before the trip and in the lobby.
4. **Most Likely To** is the anonymous vote, the round people talk about afterwards.
5. **Her vs. Everyone** returns the focus to her, live.
6. **The Final 40**: wagers make the result uncertain until the end, then the finale screen belongs to her: photographs, friends’ messages, “Forty.”

## 2. Game flow

```
admin ──▶ Host a new game ──▶ /host/CODE (lobby: QR + room code)
                                     │   players: /join/CODE → name → /play/CODE
                                     ▼
              ┌──── round intro ◀──────────────────────────────┐
              │          │                                      │
              │   (Final 40: wager) ─▶ question ─▶ reveal ──┐   │
              │          ▲                                  │   │
              │          └──────── next question ◀──────────┘   │
              │                          │ last question        │
              │                     leaderboard ────────────────┘ next round
              │                          │ last round
              └────────────────────▶   final ──▶ tie? ─▶ tie-breaker ─▶ final
```

A reveal fires on its own when the timer runs out (any device may trigger it; the server checks the clock) or when every eligible player has answered. The host can reveal, pause, add 10 seconds, skip, restart or skip a round, adjust points, or reset the game at any point.

### Scoring

| Round | Rule (defaults, all editable) |
|---|---|
| How Well Do You Know Her? | 100 per correct. Free text is auto-marked leniently; the host can overrule. She sits out. |
| General Trivia | 100 / 150 / 200 by difficulty, plus up to 50 for speed. |
| Who Said That? | 100 per correct guess. |
| Most Likely To | 50 for siding with the room’s verdict (needs at least two votes in agreement). |
| Her vs. Everyone | 100 for matching her answer; ×2 if a third or fewer got it (the surprise bonus). |
| The Final 40 | Teams wager up to their score (or 200, if higher). The majority of a team’s answers decides. Losses are capped at what the team holds. Questions marked “about her” bench her. |
| Tie-breaker | Numeric; the closest guess wins the team 10 points. |

Team score = the sum of its players’ points + team awards (wagers, tie-breakers) + manual adjustments.

## 3. Screens

**Phone**: join (code, name, “I’m the birthday girl”) · lobby (team, teammates, confession box) · round title · question (big tappable options / text / number, live timer, locked state) · sit-out (for her, when the question is about her) · private answer (her, in Her vs. Everyone) · wager · verdict (“Correct.” / “Not quite.”, points, the answer) · standings · final.

**Host screen**: lobby (QR, code, teams with live presence; tap a name to move teams, mark the birthday girl or remove someone) · round intro (roman numeral, title, her photograph) · wager board · question (huge prompt, options, timer bar, who has answered) · reveal (answer, animated distribution or vote chart, free-text marking) · leaderboard (team bars, top individuals, a fact about her) · finale (“Forty.”, her photographs and friends’ messages cycling slowly, standings or tie-breaker).

**Admin**: Play (start, preview, readiness checklist, `/confess` link, backup and restore) · Her (name, line, photos, facts) · Questions (per round, create, edit, reorder, delete, picture upload) · Friends (guest list, confessions, messages) · Rounds & scoring (enable, order, counts, timers, points, team names).

## 4. Architecture

```
Phones / host screen (Next.js client)
   │  GET  /api/rooms/CODE?pid&s | ?h     → a filtered RoomView for that viewer
   │  POST /api/rooms/CODE/join | /action → engine applies it, returns the new view
   │  Realtime: subscribe to room_pulse(CODE) → refetch the view
   ▼
Next.js route handlers (server, service-role key)
   │  src/lib/engine.ts   pure game logic: flow, scoring, views (unit-tested)
   │  src/lib/store.ts    Supabase or in-memory; optimistic concurrency
   ▼
Supabase Postgres: game_content · rooms · room_pulse · room_presence · storage/party
```

- **One JSON document per room** (`rooms.state`) holds players, questions, answers and awards. The engine is a set of pure functions over it, so the server, the tests and pass-and-play share the same rules.
- **Writes** go only through the API. Each is a read, apply, conditional write on `version` with retry, which keeps simultaneous answers safe.
- **Realtime** carries only a version number (`room_pulse`). Phones then fetch their own filtered view, so Realtime never carries answers. A slow poll backs it up; without Supabase, a fast poll replaces it.
- **Presence**: each fetch updates `room_presence`; “online” means seen in the last 20 seconds.
- **Auth**: the admin password sets a signed httpOnly cookie. Creating a room returns a random host token (kept in the host’s browser). Each player gets an id and a secret. No accounts.
- **Content** is one JSON document (`game_content`), snapshotted into each room at creation, so edits mid-game don’t break a game in progress.

### Data model (TypeScript, `src/lib/types.ts`)

`Content` → `honoree {name, tagline, photos[], facts[]}`, `guests[]`, `teams[]`, `rounds[] {kind, enabled, title, subtitle, count, timerSec, points}`, `scoring`, `questions {knowHer[], honoreeVs[], final40[], trivia[], mostLikely[], tiebreakers[]}`, `confessions[]`, `messages[]`.

`ContentQuestion` → `{id, type: mc|text|number, prompt (with {name}), options?, answer?, accept?, image?, note?, difficulty?, category?, aboutHer?, placeholder?}`.

`RoomState` → players, rounds with built questions, cursor, phase, deadline, pause state, `answers[qKey][playerId]`, `honoreeAnswers`, `marks` (host overrides), `wagers`, `awards`, `teamAwards`, `adjustments`.

## 5. MVP plan and status

| Step | Status |
|---|---|
| Engine: flow, six rounds, scoring, wagers, tie-breaker, pause / skip / restart | Done, unit-tested |
| API + storage (memory and Supabase), host and player auth, presence | Done |
| Phone controller, host screen, lobby QR | Done, tested end to end with 10 headless phones |
| Admin: content, photos, rounds, scoring, confessions, messages, preview, backup | Done |
| Pass & play | Done |
| Pre-party `/confess` form | Done |

Possible next steps, in order of value: per-player answer-change before lock (currently first tap locks); a picture-option question type (images as answers); host-chosen trivia categories; a printable scorecard export.
