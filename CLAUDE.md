# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server at localhost:3000
npm run build    # production build (also runs route-type generation)
npm run lint     # ESLint check
```

No test framework is set up yet. Add tests before running `npm test`.

## What This Is

**MoodGarden** — a responsive web app (PWA) for emotional awareness. Users log emotions up to 3×/day via push notifications, grow creature companions tied to their Plutchik emotion type, and optionally track menstrual cycles. A public anonymous community feed lets strangers share resonance.

Stack: **Next.js 16 App Router · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Auth + RLS + Realtime) · Framer Motion · Lottie · Zustand · TanStack Query · next-pwa**.  
Deployed on Vercel. No native app — iOS users use PWA (Safari → Add to Home Screen).

## Planned Route Structure

```
app/
  layout.tsx              ← root layout, global providers, PWA manifest link
  page.tsx                ← landing (unauthenticated)
  onboarding/page.tsx     ← 5-step first-run wizard
  (app)/                  ← authenticated route group
    layout.tsx            ← responsive shell: Sidebar (≥lg) / Bottom Tab Bar (<lg)
    garden/page.tsx        ← main view, creature scene
    community/page.tsx     ← anonymous social feed
    cycle/page.tsx         ← menstrual calendar + phase card (female module only)
    collection/page.tsx    ← creature collection (shown instead of cycle for others)
    me/page.tsx            ← settings
    mood-entry/page.tsx    ← emotion logging modal (Plutchik + Russell UI)
    period-entry/page.tsx  ← period symptom entry
  api/
    push-subscribe/route.ts  ← Web Push subscription endpoint
    daily-card/route.ts      ← cron-triggered daily card delivery
```

`lib/` and `data/` directories are not yet created. Key files to add:
- `lib/supabase/client.ts` — browser Supabase client  
- `lib/supabase/server.ts` — Server Component Supabase client  
- `lib/cycle.ts` — menstrual phase calculation from start date + avg length  
- `lib/creatures.ts` — creature species/level rules keyed on Plutchik emotion  
- `lib/recommendation.ts` — daily card picker (weights: recent emotion > cycle phase > dedup)  
- `lib/push.ts` — Web Push subscription helpers  
- `data/song_cards.json` — ~30 mood-tagged song cards  
- `scripts/seed-topics.json` — 30 psychology topic seeds for the knowledge-card pipeline  
- `scripts/build-knowledge-cards.ts` — OpenAlex → Claude API → Supabase pipeline  

## Emotion Model

Two-layer system (see `docs/emotion-model.md` for full detail):

1. **Plutchik (1980)** — 8 discrete primary emotions stored as `plutchik_emotion_t` enum: `joy | trust | fear | surprise | sadness | disgust | anger | anticipation`. Intensity 1–3. Adjacent pairs combine into secondary emotions (used as rare creature unlock conditions).

2. **Russell (1980)** — continuous `valence` (−1…+1) × `arousal` (−1…+1) stored as `numeric(3,2)`. Captured via draggable 2D disk UI after Plutchik selection.

## Database

Full schema in `docs/schema.sql`. Run it in the Supabase SQL Editor to bootstrap the database. All tables use Row-Level Security — users can only read/write their own rows. Exceptions: `social_posts` and `knowledge_cards`/`song_cards` are public-read.

Required environment variables (copy `.env.local.example` → `.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY     # server-only, never expose to client
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY             # server-only
VAPID_SUBJECT                 # mailto:... or https://...
```

## Responsive Design

Mobile-first with Tailwind breakpoints. The `(app)` layout renders a **bottom tab bar** at `<lg` and a **left sidebar** at `≥lg` — same components, different layout. Minimum touch target 44×44 px. Hover states scoped to `md:` and above. Garden scene adapts: portrait crop on mobile, landscape on desktop.

## Key Domain Rules

- **Creature generation**: one creature per `mood_entry`. Same primary emotion + intensity combination increments `level` (max 5). Adjacent Plutchik emotions in same session can trigger a rare `secondary_emotion` species.
- **Period module**: gated by `users.period_module_enabled`. Onboarding sets this based on `biological_sex`; user can toggle in settings anytime. Phase is derived in `lib/cycle.ts` from the latest `period_cycles.start_date` + `avg_cycle_length` — never hardcoded.
- **Knowledge card delivery**: one card per user per day via the `/api/daily-card` cron route. Selection weights recent 3-day dominant emotion, then cycle phase (for female-module users), then excludes cards in `card_deliveries` from the past 30 days. Cold-start (< 7 days): fixed intro deck.
- **Social posts**: auto-created when `mood_entries.is_public = true`. Resonance counts are public; individual reactor identities are not (RLS prevents cross-user reads on `resonances`).
