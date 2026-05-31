import { google } from 'googleapis';
import { getAdminClient } from './supabase.js';
import { getGoogleRedirectUri } from './env.js';

export { buildGoogleRedirectUri, validateRedirectUri, resolveRedirectUri } from './env.js';

/** Row key in public.integrations for workspace Google OAuth (YouTube + Drive). */
export const GOOGLE_SERVICE_NAME = 'google';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive',
];

export async function getTeamGoogleConfig(teamId) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('team_google_config')
    .select('client_id, client_secret')
    .eq('team_id', teamId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function createOAuthClient(config, redirectUri = getGoogleRedirectUri()) {
  return new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    redirectUri
  );
}

export async function getStoredIntegration(teamId) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('integrations')
    .select('*')
    .eq('team_id', teamId)
    .eq('service_name', GOOGLE_SERVICE_NAME)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveIntegration(teamId, tokens, metadata = {}, extra = {}) {
  const admin = getAdminClient();
  const existing = await getStoredIntegration(teamId);
  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString()
    : null;

  const mergedMeta = { ...(existing?.metadata || {}), ...metadata };

  // Legacy DB schemas may have top-level connected_by (uuid/text) NOT NULL — not only metadata jsonb
  const connectedBy =
    extra.connectedBy ?? existing?.connected_by ?? mergedMeta.connected_by ?? null;

  const row = {
    team_id: teamId,
    service_name: GOOGLE_SERVICE_NAME,
    access_token: tokens.access_token ?? existing?.access_token,
    refresh_token: tokens.refresh_token ?? existing?.refresh_token,
    token_expires_at: expiresAt ?? existing?.token_expires_at,
    is_active: true,
    metadata: mergedMeta,
    updated_at: new Date().toISOString(),
  };

  if (connectedBy) {
    row.connected_by = connectedBy;
  }

  if (!row.refresh_token) {
    throw new Error('No Google refresh token to save');
  }

  const { error: upsertError } = await admin.from('integrations').upsert(row, {
    onConflict: 'team_id,service_name',
  });

  if (upsertError) {
    if (existing?.id) {
      const { error: updateError } = await admin
        .from('integrations')
        .update(row)
        .eq('id', existing.id);
      if (updateError) {
        throw new Error(`Could not save Google tokens: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await admin.from('integrations').insert(row);
      if (insertError) {
        throw new Error(
          `Could not save Google tokens: ${insertError.message}. Run migrations 005–007 in supabase/migrations/ (SQL Editor).`
        );
      }
    }
  }

  const saved = await getStoredIntegration(teamId);
  if (!saved?.refresh_token) {
    throw new Error('Google tokens were not stored. Check integrations table and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return saved;
}

export async function getAuthorizedClient(teamId) {
  const config = await getTeamGoogleConfig(teamId);
  if (!config) throw new Error('Google Cloud credentials are not configured for this workspace');

  const integration = await getStoredIntegration(teamId);
  if (!integration?.refresh_token) {
    throw new Error('Google is not connected. Connect in Settings → Integrations.');
  }

  const oauth2 = createOAuthClient(config);
  oauth2.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
    expiry_date: integration.token_expires_at
      ? new Date(integration.token_expires_at).getTime()
      : null,
  });

  oauth2.on('tokens', async (tokens) => {
    if (!tokens.access_token) return;
    await saveIntegration(teamId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || integration.refresh_token,
      expiry_date: tokens.expiry_date,
    }, integration.metadata || {});
  });

  return oauth2;
}

export function encodeOAuthState(teamId, userId, redirectUri) {
  return Buffer.from(
    JSON.stringify({ teamId, userId, redirectUri, t: Date.now() })
  ).toString('base64url');
}

export function decodeOAuthState(state) {
  const json = Buffer.from(state, 'base64url').toString('utf8');
  const parsed = JSON.parse(json);
  if (!parsed.teamId || !parsed.userId) throw new Error('Invalid OAuth state');
  if (Date.now() - parsed.t > 1000 * 60 * 30) throw new Error('OAuth state expired');
  return parsed;
}

export const DEFAULT_PUBLISHING_SETTINGS = {
  defaultPrivacy: 'private',
  autoCreateDriveFolder: true,
};

export function getPublishingSettings(integration) {
  return {
    ...DEFAULT_PUBLISHING_SETTINGS,
    ...(integration?.metadata?.publishing || {}),
  };
}

export async function savePublishingSettings(teamId, publishing) {
  const integration = await getStoredIntegration(teamId);
  const metadata = {
    ...(integration?.metadata || {}),
    publishing: {
      ...DEFAULT_PUBLISHING_SETTINGS,
      ...(integration?.metadata?.publishing || {}),
      ...publishing,
    },
  };
  await saveIntegration(
    teamId,
    {
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
      expiry_date: integration.token_expires_at
        ? new Date(integration.token_expires_at).getTime()
        : null,
    },
    metadata
  );
  return metadata.publishing;
}
