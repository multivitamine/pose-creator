# Pose Creator

Shot-based bulk image workflow tool. Each uploaded base image becomes a numbered shot;
generate a mannequin from it, pick two model sources, generate variations, compare with a
slider, and save selections. Built on Next.js 15 (App Router) + Supabase + Cloudflare R2 +
the RunningHub generation API.

## How generation works
Generation is a durable background queue — submitting returns immediately and RunningHub does
the waiting. Completion is finalized by a webhook (production) or a reconcile poll (local/fallback).
No long-running serverless functions; every route is short.

## Local development
1. `cp .env.example .env` and fill in the values (RunningHub, Supabase, R2).
2. Leave `APP_URL` empty locally — completion is handled by the shot page's reconcile poll.
3. `npm install`
4. `npm run dev` → http://localhost:3000

## Database
Schema lives in `supabase/migrations/`. Tables are prefixed `rh_` (shots, images, jobs, sources,
settings). Apply migrations via the Supabase SQL editor or the Management API.

## Deploy (Vercel)
1. Import the repo in Vercel.
2. Set all variables from `.env.example` in Project → Settings → Environment Variables.
3. Set `APP_URL` to the deployed URL (e.g. `https://<project>.vercel.app`) so RunningHub
   webhooks fire, and set a strong `WEBHOOK_SECRET`.
4. Deploy.

## Routes
- `/` shot overview · `/upload` create shots · `/shots/[id]` shot detail
- `/sources` reusable model library · `/settings` prompts & defaults · `/saved` saved results
