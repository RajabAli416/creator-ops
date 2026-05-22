# Security

## Secrets

- **Never commit** `.env.local`, `.env`, or any file containing Supabase keys, service role keys, or passwords.
- The **anon / publishable** key is safe to use in the browser but should still be loaded from environment variables, not hardcoded in source.
- **Never commit** the Supabase **service_role** key — it bypasses Row Level Security.

## Before pushing to GitHub

1. Confirm `.env.local` is ignored: `git check-ignore -v .env.local`
2. Search the repo: `git grep -i "sb_publishable\|service_role\|eyJhbG"` (should return nothing in tracked files)
3. Only commit `.env.example` with placeholder values.

## If you accidentally committed a secret

1. Rotate the key in the Supabase dashboard immediately.
2. Remove the secret from git history (e.g. [git-filter-repo](https://github.com/newren/git-filter-repo)) or create a new repo without the leaked commit.
