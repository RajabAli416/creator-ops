export function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  );
}

export function getSupabaseAnonKey() {
  return (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ''
  );
}

export function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

export function getAppOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (process.env.VITE_APP_URL) return process.env.VITE_APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:5173';
}

export const GOOGLE_OAUTH_CALLBACK_PATH = '/integrations/google/callback';

export function buildGoogleRedirectUri(origin) {
  return `${String(origin).replace(/\/$/, '')}${GOOGLE_OAUTH_CALLBACK_PATH}`;
}

/** Redirect URI must match Google Console entry exactly. */
export function validateRedirectUri(uri) {
  try {
    const u = new URL(uri);
    if (u.pathname !== GOOGLE_OAUTH_CALLBACK_PATH) return false;
    if (u.hostname === 'localhost') {
      return u.protocol === 'http:' || u.protocol === 'https:';
    }
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getGoogleRedirectUri() {
  return buildGoogleRedirectUri(getAppOrigin());
}

/** Prefer the browser origin sent by the client so OAuth matches the open tab. */
export function resolveRedirectUri(req) {
  const fromQuery = req?.query?.redirectUri;
  const fromBody = req?.body?.redirectUri;
  const candidate = fromQuery || fromBody;
  if (candidate && validateRedirectUri(candidate)) return candidate;

  const origin = req?.headers?.origin || req?.headers?.Origin;
  if (origin) {
    const fromOrigin = buildGoogleRedirectUri(origin);
    if (validateRedirectUri(fromOrigin)) return fromOrigin;
  }

  return getGoogleRedirectUri();
}
