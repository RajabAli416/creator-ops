export const GOOGLE_CLOUD_SETUP_STEPS = [
  'Open Google Cloud Console and create a project (or pick an existing one).',
  'Enable APIs: YouTube Data API v3 and Google Drive API.',
  'Go to APIs & Services → OAuth consent screen → configure (External is fine for testing; add test users).',
  'Go to Credentials → Create credentials → OAuth client ID → Web application.',
  'Add Authorized redirect URI (copy from the Integrations tab in Settings).',
  'Paste the Client ID and Client secret below, then click Connect Google.',
];

export function getRedirectUriHint() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/integrations/google/callback`;
}
