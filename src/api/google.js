import { supabase } from '@/lib/supabase';

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in required');
  return session.access_token;
}

async function googleApi(path, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(`/api/google/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || res.statusText || 'Request failed');
  return body;
}

export const googleApiClient = {
  getStatus(teamId) {
    return googleApi(`status?teamId=${encodeURIComponent(teamId)}`);
  },

  getRedirectUri() {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/integrations/google/callback`;
  },

  getOAuthUrl(teamId) {
    const redirectUri = this.getRedirectUri();
    const qs = new URLSearchParams({ teamId, redirectUri });
    return googleApi(`oauth-url?${qs}`);
  },

  exchangeCode(code, state) {
    return googleApi('oauth-token', {
      method: 'POST',
      body: JSON.stringify({
        code,
        state,
        redirectUri: this.getRedirectUri(),
      }),
    });
  },

  disconnect(teamId) {
    return googleApi('disconnect', {
      method: 'POST',
      body: JSON.stringify({ teamId }),
    });
  },

  createDriveFolder({ teamId, contentItemId, folderName, shareWithEmails }) {
    return googleApi('drive-folder', {
      method: 'POST',
      body: JSON.stringify({ teamId, contentItemId, folderName, shareWithEmails }),
    });
  },

  scanDrive(teamId) {
    return googleApi('drive-scan', {
      method: 'POST',
      body: JSON.stringify({ teamId }),
    });
  },

  publishFromDrive({ teamId, contentItemId, title, description, privacyStatus }) {
    return googleApi('youtube-publish-from-drive', {
      method: 'POST',
      body: JSON.stringify({
        teamId,
        contentItemId,
        title,
        description,
        privacyStatus,
      }),
    });
  },

  getPublishingSettings(teamId) {
    return googleApi(`publishing-settings?teamId=${encodeURIComponent(teamId)}`);
  },

  savePublishingSettings(teamId, settings) {
    return googleApi('publishing-settings', {
      method: 'POST',
      body: JSON.stringify({ teamId, ...settings }),
    });
  },

  async uploadToYoutube({ teamId, contentItemId, title, description, privacyStatus, file }) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    const fileBase64 = btoa(binary);

    return googleApi('youtube-upload', {
      method: 'POST',
      body: JSON.stringify({
        teamId,
        contentItemId,
        title,
        description,
        privacyStatus,
        fileBase64,
        mimeType: file.type || 'video/mp4',
      }),
    });
  },
};

export async function saveGoogleOAuthConfig(teamId, { clientId, clientSecret }) {
  const { error } = await supabase.from('team_google_config').upsert(
    {
      team_id: teamId,
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'team_id' }
  );
  if (error) throw error;
}

export async function getGoogleOAuthConfig(teamId) {
  const { data, error } = await supabase
    .from('team_google_config')
    .select('client_id, updated_at')
    .eq('team_id', teamId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
