-- MoodGarden Supabase / Postgres Schema
-- Version: 0.1.0 (MVP)
-- Usage: paste into Supabase SQL Editor and run. Extensions enabled by default on Supabase.
-- All tables use UUID primary keys and reference auth.users for identity.

-- ================================================================
-- ENUMS
-- ================================================================

do $$ begin
  create type biological_sex_t as enum ('female', 'male', 'prefer_not_to_say');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plutchik_emotion_t as enum (
    'joy', 'trust', 'fear', 'surprise',
    'sadness', 'disgust', 'anger', 'anticipation'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type flow_level_t as enum ('none', 'light', 'medium', 'heavy');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cycle_phase_t as enum ('menstrual', 'follicular', 'ovulation', 'luteal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type card_type_t as enum ('psychology', 'cycle');
exception when duplicate_object then null; end $$;

do $$ begin
  create type card_status_t as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;


-- ================================================================
-- users
-- ================================================================

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  anonymous_nickname text not null,
  avatar_seed text not null,
  biological_sex biological_sex_t default 'prefer_not_to_say',
  period_module_enabled boolean default false,
  notification_times text[] default array['09:00','14:00','21:00']::text[],
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy users_self_read on public.users for select using (auth.uid() = id);
create policy users_self_update on public.users for update using (auth.uid() = id);
create policy users_self_insert on public.users for insert with check (auth.uid() = id);


-- ================================================================
-- mood_entries
-- ================================================================

create table if not exists public.mood_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  primary_emotion plutchik_emotion_t not null,
  plutchik_intensity smallint not null check (plutchik_intensity between 1 and 3),
  valence numeric(3,2) check (valence between -1 and 1),
  arousal numeric(3,2) check (arousal between -1 and 1),
  secondary_emotion plutchik_emotion_t,
  note text check (char_length(note) <= 60),
  is_public boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists mood_entries_user_time_idx
  on public.mood_entries (user_id, created_at desc);

alter table public.mood_entries enable row level security;

create policy mood_self_all on public.mood_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ================================================================
-- creatures
-- ================================================================

create table if not exists public.creatures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  species text not null,
  level smallint not null default 1 check (level between 1 and 5),
  nickname text,
  born_at timestamptz not null default now(),
  last_fed_at timestamptz
);

create index if not exists creatures_user_idx on public.creatures (user_id);

alter table public.creatures enable row level security;
create policy creatures_self_all on public.creatures for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ================================================================
-- gardens
-- ================================================================

create table if not exists public.gardens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  theme text not null default 'meadow',
  layout jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.gardens enable row level security;
create policy gardens_self_all on public.gardens for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ================================================================
-- social_posts  (public read, author-only delete)
-- ================================================================

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  mood_entry_id uuid not null references public.mood_entries(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  creature_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists social_posts_time_idx on public.social_posts (created_at desc);

alter table public.social_posts enable row level security;
create policy social_public_read on public.social_posts for select using (true);
create policy social_author_insert on public.social_posts for insert with check (auth.uid() = user_id);
create policy social_author_delete on public.social_posts for delete using (auth.uid() = user_id);


-- ================================================================
-- resonances  (anonymous hearts)
-- ================================================================

create table if not exists public.resonances (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists resonances_post_idx on public.resonances (post_id);

alter table public.resonances enable row level security;
-- Users cannot browse other users' resonance records to avoid comparison anxiety.
create policy resonances_self_all on public.resonances for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ================================================================
-- song_cards  (catalog, public read)
-- ================================================================

create table if not exists public.song_cards (
  id uuid primary key default gen_random_uuid(),
  mood_tag plutchik_emotion_t not null,
  song_title text not null,
  artist text not null,
  vibe_description text,
  cover_image_url text,
  external_url text
);

alter table public.song_cards enable row level security;
create policy song_cards_public_read on public.song_cards for select using (true);


-- ================================================================
-- user_card_draws
-- ================================================================

create table if not exists public.user_card_draws (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  card_id uuid not null references public.song_cards(id) on delete cascade,
  mood_entry_id uuid references public.mood_entries(id) on delete set null,
  drawn_at timestamptz not null default now()
);

create index if not exists user_card_draws_user_idx on public.user_card_draws (user_id, drawn_at desc);

alter table public.user_card_draws enable row level security;
create policy user_card_draws_self_all on public.user_card_draws for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ================================================================
-- period_cycles
-- ================================================================

create table if not exists public.period_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  start_date date not null,
  end_date date,
  avg_cycle_length smallint default 28 check (avg_cycle_length between 15 and 60),
  predicted_next_start date
);

create index if not exists period_cycles_user_idx on public.period_cycles (user_id, start_date desc);

alter table public.period_cycles enable row level security;
create policy period_cycles_self_all on public.period_cycles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ================================================================
-- period_logs (daily symptom records)
-- ================================================================

create table if not exists public.period_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  log_date date not null,
  flow_level flow_level_t default 'none',
  pain_level smallint check (pain_level between 0 and 5),
  symptoms jsonb default '[]'::jsonb,
  sex_drive smallint check (sex_drive between 0 and 5),
  notes text,
  unique (user_id, log_date)
);

create index if not exists period_logs_user_date_idx on public.period_logs (user_id, log_date desc);

alter table public.period_logs enable row level security;
create policy period_logs_self_all on public.period_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ================================================================
-- knowledge_cards  (AI-generated psychology / cycle cards)
-- ================================================================

create table if not exists public.knowledge_cards (
  id uuid primary key default gen_random_uuid(),
  type card_type_t not null,
  title text not null,
  body_md text not null,
  target_emotions plutchik_emotion_t[] default '{}'::plutchik_emotion_t[],
  target_phase cycle_phase_t,
  primary_source_doi text,
  primary_source_citation_text text,
  secondary_sources jsonb default '[]'::jsonb,
  citation_count_at_creation integer,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  status card_status_t default 'draft',
  created_at timestamptz not null default now()
);

create index if not exists knowledge_cards_status_idx on public.knowledge_cards (status, type);

alter table public.knowledge_cards enable row level security;
create policy knowledge_cards_published_read on public.knowledge_cards for select using (status = 'published');


-- ================================================================
-- card_deliveries  (what we've shown each user — dedupe + analytics)
-- ================================================================

create table if not exists public.card_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  card_id uuid not null references public.knowledge_cards(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  opened_at timestamptz,
  helpful_rating smallint check (helpful_rating between -1 and 1)
);

create index if not exists card_deliveries_user_idx on public.card_deliveries (user_id, delivered_at desc);

alter table public.card_deliveries enable row level security;
create policy card_deliveries_self_all on public.card_deliveries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ================================================================
-- push_subscriptions  (Web Push)
-- ================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;
create policy push_subs_self_all on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
