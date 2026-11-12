# 40 & Questionable

A private, mobile-first party game for Crystal’s fortieth. One shared host screen, six to ten phones, no app, no accounts. (The code folder is still called `quarante`, its working name.)

**The default game is 40 questions in four rounds of ten:**

| Round | What happens |
|---|---|
| I · Crystal Clear? | Questions about Crystal: multiple choice, photo or free text. She can give her real answers in advance on her own page. |
| II · The Past 40 Years | 1986 to 2026 in order. A bank of 46 questions; ten are switched on, swap any of them. |
| III · The Men of Questionable Taste | Everyone votes on a lineup of men. Each man is secretly one of the girls; the girl behind the most-voted man scores. Optional Kill / F / Marry bonus. Ends with the unmasking. |
| IV · No Further Questions | Who Said That? confessions, stories where the options are the girls, questions for Crystal, and a final birthday question. |

Scores are sealed until the end: answers are revealed after every question, points only at the final reveal. Question counts, bonus questions, extra rounds (General Trivia, Most Likely To, Her vs. Everyone, a team wager round), timers and scoring are all adjustable in `/admin`. The design brief, game flow and architecture are in [`docs/DESIGN.md`](docs/DESIGN.md).

## Run it locally (two minutes, no database)

```bash
cd quarante
npm install
npm run dev            # http://localhost:3000
```

- Admin: `http://localhost:3000/admin`. Locally the password is `quarante` until you set `ADMIN_PASSWORD`.
- Without Supabase the app uses an **in-memory store**: rooms and edits live in the dev server process and vanish on restart. Use *Play → Export JSON* to keep a backup. Phones on the same Wi-Fi can join via your machine’s LAN address (`npm run dev -- -H 0.0.0.0`).
- Tests: `npm test` (see below).

## Pages

| Path | Who | What |
|---|---|---|
| `/` | everyone | Welcome: Join the game · I’m the birthday girl · Host |
| `/join`, `/join/ABCD` | players | Room code, then tap your own portrait and confirm your name (the QR code links here) |
| `/play/ABCD` | players | The phone controller. Survives refresh and dropped connections |
| `/host/ABCD` | host | The shared screen: lobby with QR, questions, reveals, leaderboards, finale |
| `/admin` | host | Players & portraits (hers and his), every question, import, rounds, scoring, start or preview a game |
| `/her` | the birthday girl | Her own login (password set in the admin). She answers her questions privately before the party |
| `/confess` | friends, before the trip | Send confessions and a message for her |
| `/solo` | host | Pass & play on one phone, no network needed after loading |

## Deploy (Vercel + Supabase)

### 1. Supabase
1. Create a project at supabase.com.
2. SQL editor → paste and run [`supabase/schema.sql`](supabase/schema.sql). It creates the tables, row-level security, the Realtime publication and a public `party` storage bucket for photos.
3. Project Settings → API: copy the **Project URL**, the **anon** key and the **service_role** key.

### 2. Vercel
1. Import the GitHub repo in Vercel.
2. **Root Directory: `quarante`** (the repo root holds a different app). Framework preset: Next.js.
3. Environment variables (see [`.env.example`](.env.example)):

| Variable | Notes |
|---|---|
| `ADMIN_PASSWORD` | Required in production. Protects `/admin`, hosting and the answers |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key. The browser can only read room “pulses” with it |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key. Server only, never exposed |

4. Deploy. Open `/admin`, sign in, fill in her details, then **Play → Host a new game**.

Supabase is required on Vercel: serverless functions don’t share memory, so the in-memory fallback won’t hold a room there.

## Before the trip

1. **Players & portraits**: for each girl, her real name and portrait, and her man for Round 3: his fictional name and one or more portraits (they rotate between questions; the first is used at the unmasking). Every photo goes through the same 4:5 cropper. Mark Crystal as the birthday girl.
2. **Her**: set Crystal’s password and send her the `/her` link. Her answers become the real answers and stay hidden from you behind a spoiler button.
3. **Questions**: each round’s list has ON / BANK switches, a bonus flag, drag-free reordering (Move up / Move down), search and **Import** (CSV or JSON).
4. **Friends**: send the `/confess` link for Who Said That? confessions and messages for her.
5. **Play → Preview**: opens a test room and a test player. *Players & portraits → Preview the unmasking* rehearses the big reveal.

### Importing questions

CSV with a header row, or JSON (an array of objects with the same names):

```csv
prompt,a,b,c,d,answer,difficulty,year,note,bonus
In which year did the first iPhone go on sale?,2005,2007,2008,2009,B,easy,2007,,
```

`answer` can be a letter, a 1-based number, or the option text. For Round III use `prompt,type,bonus` with type `vote` or `kfm`.

## On the night

1. Put `/host/CODE` on a TV or laptop. If you started the game on your phone, *More → Copy host link* opens the host screen on another device.
2. Everyone scans the QR code, sees the six portraits, taps her own and confirms her name. Her portrait turns READY on every screen. A portrait can only be claimed once; if someone taps the wrong one, tap it on the host screen and choose **Unlock portrait**.
3. While people arrive, they can type confessions on their phones for Who Said That?
4. The host drives with the big button (or Space / →). The button glows when everyone has answered. `P` pauses, `H` hides the controls.
5. Round III has no clock: the host closes each vote. The lineup reshuffles for every question, identically on every phone. After the last question comes the unmasking, one man at a time, fewest votes first, then everyone side by side.
6. *More* opens manual point adjustments, round restart and round skip.
7. The final screen reveals the scores from last place up. If the top two are level, it offers a tie-breaker.

If you are hosting and playing at once: join on your phone too. Because your phone holds the host key, a small host strip appears at the bottom of your player screen.

## Reliability

- **Refresh / reconnect**: each phone keeps a private player key; reloading or losing signal resumes the same seat and score.
- **Lost phone / cleared browser**: rejoin with the same name. Once the old device has been silent for about 20 seconds, the seat is handed back.
- **Duplicate taps**: the first answer locks. Later submissions are ignored, never double counted.
- **Simultaneous answers**: room writes use optimistic concurrency (a version check with retry), so ten phones answering in the same second don’t overwrite each other.
- **Timers** run on server time; the phones correct for their own clock drift. Pausing freezes the remaining time.
- **No answer leaks**: phones receive a filtered view. Correct answers, other players’ answers and her private answers are sent only at the reveal.
- **The men’s identities stay on the server.** Each man is a random token per game; no phone or screen receives which girl he is until his card is turned at the unmasking, and Round III points stay out of every score until then.
- **Private photos.** Portraits live in a private storage bucket. Screens get signed links that expire after six hours; nothing is publicly reachable. (If you set up Supabase before this change, run `supabase/schema.sql` again to make the bucket private.)
- **Temporary rooms**: room codes expire after 18 hours.

## Content rules

Everything about Crystal and her friends ships as **placeholders** (“Friend 2”, “Placeholder”, “To do” on the Play tab). Nothing about her is invented. The male names (Chad, Brad, Todd, Kyle, Trent, Lance) are invented characters; rename them freely. Placeholder free-text questions reveal as “Answer not entered yet” so you notice in preview.

The Past 40 Years bank runs in order from 1986 to 2025 and mixes easy, medium and hard. The 110 general trivia questions (for the optional General Trivia round) lean towards the 90s and 2000s. Every question is editable.

## Tests

`npm test` runs the game engine through complete games: 601 checks, including one portrait per player, reconnection, sealed scores, the men’s lineup never revealing who is who before the unmasking, and a full 41-question game (40 plus the bonus).
