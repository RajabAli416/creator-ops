import { getUserFromBearer, assertTeamMember } from '../_lib/supabase.js';
import { getStoredIntegration, getTeamGoogleConfig, getPublishingSettings } from '../_lib/google.js';
import { getGoogleRedirectUri, resolveRedirectUri } from '../_lib/env.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromBearer(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const teamId = req.query?.teamId;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    if (!(await assertTeamMember(user.id, teamId))) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const config = await getTeamGoogleConfig(teamId);
    const integration = await getStoredIntegration(teamId);

    const redirectUriFromRequest = resolveRedirectUri(req);

    return res.status(200).json({
      configured: !!(config?.client_id && config?.client_secret),
      connected: !!(integration?.is_active && integration?.refresh_token),
      channelTitle: integration?.metadata?.channel_title || null,
      connectedAt: integration?.metadata?.connected_at || null,
      publishing: getPublishingSettings(integration),
      redirectUri: redirectUriFromRequest,
      serverFallbackRedirectUri: getGoogleRedirectUri(),
    });
  } catch (err) {
    console.error('status', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
