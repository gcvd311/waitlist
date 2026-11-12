-- Quarante: Supabase schema. Run once in the Supabase SQL editor.

-- Editable game content (one row, id = 'default'). Server-only: holds the answers.
create table if not exists public.game_content (
  id text primary key,
  content jsonb not null,
  updated_at timestamptz not null default now()
);

-- One row per live room. The whole game state is a JSON document,
-- written with optimistic concurrency (version) by the Next.js API.
create table if not exists public.rooms (
  code text primary key,
  state jsonb not null,
  version integer not null default 1,
  host_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists rooms_expires_idx on public.rooms (expires_at);

-- A tiny public "something changed" signal per room. Phones subscribe to it via
-- Realtime and then fetch their own filtered view from the API, so no answers leak.
create table if not exists public.room_pulse (
  code text primary key,
  version integer not null,
  updated_at timestamptz not null default now()
);

-- Who is connected (heartbeat on every fetch).
create table if not exists public.room_presence (
  code text not null,
  player_id text not null,
  seen_at timestamptz not null default now(),
  primary key (code, player_id)
);

-- Row level security: the browser (anon key) can only read pulses.
-- Everything else goes through the API with the service role key.
alter table public.game_content enable row level security;
alter table public.rooms enable row level security;
alter table public.room_presence enable row level security;
alter table public.room_pulse enable row level security;

drop policy if exists "pulse readable" on public.room_pulse;
create policy "pulse readable" on public.room_pulse for select to anon, authenticated using (true);

-- Realtime
do $$ begin
  alter publication supabase_realtime add table public.room_pulse;
exception when duplicate_object then null; end $$;

-- Storage bucket for photos. PRIVATE: nothing is readable without a signed link,
-- which the server hands out (valid 6 hours) only inside the game and the admin.
insert into storage.buckets (id, name, public)
values ('party', 'party', false)
on conflict (id) do update set public = false;

-- Housekeeping: expired rooms are also deleted whenever a new room is created.
-- Optional, if pg_cron is enabled:
-- select cron.schedule('quarante-cleanup', '0 * * * *', $$
--   delete from public.rooms where expires_at < now();
--   delete from public.room_pulse where updated_at < now() - interval '1 day';
--   delete from public.room_presence where seen_at < now() - interval '1 day';
-- $$);
