# Quarante

A private, mobile-first party game for a fortieth birthday. One shared host screen, ten phones, no app, no accounts.

Six rounds: **How Well Do You Know Her?**, **General Trivia**, **Who Said That?**, **Most Likely To**, **Her vs. Everyone**, **The Final 40** (team wagers). Everything about the birthday girl is edited in `/admin`, never in code. The design brief, game flow and architecture are in [`docs/DESIGN.md`](docs/DESIGN.md).

## Run it locally (two minutes, no database)

```bash
cd quarante
npm install
npm run dev            # http://localhost:3000
```

- Admin: `http://localhost:3000/admin`. Locally the password is `quarante` until you set `ADMIN_PASSWORD`.
- Without Supabase the app uses an **in-memory store**: rooms and edits live in the dev server process and vanish on restart. Use *Play → Export JSON* to keep a backup. Phones on the same Wi-Fi can join via your machine’s LAN address (`npm run dev -- -H 0.0.0.0`).
- Tests: `npm test` runs the game engine through a full 10-player game, plus edge cases (111 checks).

## Pages

| Path | Who | What |
|---|---|---|
| `/` | everyone | Landing |
| `/join`, `/join/ABCD` | players | Enter code and name (the QR code links here) |
| `/play/ABCD` | players | The phone controller. Survives refresh and dropped connections |
| `/host/ABCD` | host | The shared screen: lobby with QR, questions, reveals, leaderboards, finale |
| `/admin` | host | Content, rounds, scoring, photos, confessions, messages, start or preview a game |
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

## On the night

1. Put `/host/CODE` on a TV or laptop. If you started the game on your phone, *More → Copy host link* opens the host screen on another device.
2. Everyone scans the QR code, enters their name and can add a photo (it opens the front camera). The birthday girl ticks “I’m the birthday girl” (or the host taps her name in the lobby).
3. While people arrive, they can type confessions on their phones for **Who Said That?**
4. The host drives with the big button (or Space / →). `P` pauses, `H` hides the controls.
5. Reveals happen on their own when the timer ends or everyone has answered. For free-text answers, tap a player’s **Right / Wrong** to overrule the auto-marking.
6. *More* opens manual point adjustments, round restart and round skip.
7. If teams are level at the end, the finale offers a tie-breaker (closest number wins).

If you are hosting and playing at once: join on your phone too. Because your phone holds the host key, a small host strip appears at the bottom of your player screen.

## Reliability

- **Refresh / reconnect**: each phone keeps a private player key; reloading or losing signal resumes the same seat and score.
- **Lost phone / cleared browser**: rejoin with the same name. Once the old device has been silent for about 20 seconds, the seat is handed back.
- **Duplicate taps**: the first answer locks. Later submissions are ignored, never double counted.
- **Simultaneous answers**: room writes use optimistic concurrency (a version check with retry), so ten phones answering in the same second don’t overwrite each other.
- **Timers** run on server time; the phones correct for their own clock drift. Pausing freezes the remaining time.
- **No answer leaks**: phones receive a filtered view. Correct answers, other players’ answers and her private answers are sent only at the reveal.
- **Temporary rooms**: room codes expire after 18 hours.

## Content rules

All birthday-girl content ships as **placeholders** marked in the admin (“Placeholder”, “To do” on the Play tab). Nothing about her is invented. Placeholder free-text questions reveal as “Answer not entered yet” so you notice in preview.

Before the party, give her the `/her` link and the password from *Admin → Her*. Whatever she answers there becomes the real answer for How Well Do You Know Her?, Her vs. Everyone and the Final 40 questions about her. The admin marks those questions “She answered” and hides her answer behind a spoiler button, so the host can play too.

The 110 starter trivia questions (medium and hard only) lean towards the 90s and 2000s: music, fashion, film and TV, celebrity, geography, general knowledge, food and drink. All of them are editable in *Admin → Questions → General trivia*, and you choose the difficulty each game uses.
