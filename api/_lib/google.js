import { google } from 'googleapis';
import { getAdminClient } from './supabase.js';
import { getGoogleRedirectUri } from './env.js';

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

export function createOAuthClient(config) {
  return new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    getGoogleRedirectUri()
  );
}

export async function getStoredIntegration(teamId) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('integrations')
    .select('*')
    .eq('team_id', teamId)
    .eq('service_name', 'google')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveIntegration(teamId, tokens, metadata = {}) {
  const admin = getAdminClient();
  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString()
    : null;

  const row = {
    team_id: teamId,
    service_name: 'google',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: expiresAt,
    is_active: true,
    metadata,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from('integrations').upsert(row, {
    onConflict: 'team_id,service_name',
  });
  if (error) throw error;
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

export function encodeOAuthState(teamId, userId) {
  return Buffer.from(JSON.stringify({ teamId, userId, t: Date.now() })).toString('base64url');
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
