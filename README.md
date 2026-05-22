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

**First-time Supabase setup:** run migrations in the Supabase SQL Editor:

1. `supabase/migrations/001_profiles_and_rls.sql` — profile trigger + RLS
2. `supabase/migrations/002_google_integrations.sql` — Google OAuth config + integrations policies

**Google (YouTube + Drive):** workspace owners configure their own Google Cloud OAuth client in **Settings → Integrations**, connect Google, then use **Content detail** to upload videos or create shared Drive folders. Server routes live under `/api/google/*` and need `SUPABASE_SERVICE_ROLE_KEY` and `APP_URL` in Vercel (see `.env.example`). For local API testing, run `npx vercel dev` and set `VITE_API_PROXY=http://127.0.0.1:3000`.

**First visit:** sign up at `/signup` (email/password or **Continue with Google**), then create a workspace or join with the workspace **slug** (Settings → General).

**Sign in with Google (Supabase Auth):** In Supabase Dashboard → **Authentication** → **Providers** → enable **Google**, add your Google OAuth client ID/secret, and under **URL Configuration** add redirect URLs: `http://localhost:5173/` and your production URL (e.g. `https://your-app.vercel.app/`). This is separate from the workspace YouTube/Drive integration in Settings.

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
