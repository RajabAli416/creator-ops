import { getUserFromBearer, assertTeamOwner } from '../_lib/supabase.js';
import {
  createOAuthClient,
  getTeamGoogleConfig,
  GOOGLE_SCOPES,
  encodeOAuthState,
} from '../_lib/google.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromBearer(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const teamId = req.query?.teamId;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    if (!(await assertTeamOwner(user.id, teamId))) {
      return res.status(403).json({ error: 'Only workspace owners can connect Google' });
    }

    const config = await getTeamGoogleConfig(teamId);
    if (!config?.client_id || !config?.client_secret) {
      return res.status(400).json({
        error: 'Add your Google Cloud OAuth client ID and secret in Settings first',
      });
    }

    const oauth2 = createOAuthClient(config);
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GOOGLE_SCOPES,
      state: encodeOAuthState(teamId, user.id),
    });

    return res.status(200).json({ url });
  } catch (err) {
    console.error('oauth-url', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
