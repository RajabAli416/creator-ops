# Creator Ops

Operations hub for creator teams: content pipeline, tasks, team members, and workspace settings.

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
npm install
npm start
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

Backend: [Supabase](https://supabase.com) (Auth + Postgres).

```bash
cp .env.example .env.local
# Edit .env.local with your Supabase URL + anon/publishable key (Dashboard → Settings → API)
```

**Do not commit** `.env.local` or any file with real API keys. Only `.env.example` (placeholders) belongs in git.

**First-time Supabase setup:** run `supabase/migrations/001_profiles_and_rls.sql` in the Supabase SQL Editor (creates profile trigger + RLS policies).

**First visit:** sign up at `/signup`, then create a workspace or join with the workspace **slug** (Settings → General).

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start dev server |
| `npm run dev` | Same as `npm start` |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Deploy (Vercel / Netlify)

This app uses client-side routing (`/pipeline`, `/content/:id`, etc.). The repo includes `vercel.json` and `public/_redirects` so refreshes serve `index.html` instead of a platform 404.
| `npm run lint` | Run ESLint |
