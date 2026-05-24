import { google } from 'googleapis';
import { getUserFromBearer, assertTeamOwner } from '../_lib/supabase.js';
import {
  createOAuthClient,
  getTeamGoogleConfig,
  decodeOAuthState,
  saveIntegration,
  resolveRedirectUri,
} from '../_lib/google.js';
import { getGoogleRedirectUri } from '../_lib/env.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromBearer(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { code, state } = req.body || {};
    if (!code || !state) {
      return res.status(400).json({ error: 'code and state are required' });
    }

    const { teamId, userId, redirectUri: stateRedirectUri } = decodeOAuthState(state);
    if (userId !== user.id) {
      return res.status(403).json({ error: 'OAuth state does not match signed-in user' });
    }
    if (!(await assertTeamOwner(user.id, teamId))) {
      return res.status(403).json({ error: 'Owner only' });
    }

    const config = await getTeamGoogleConfig(teamId);
    if (!config) return res.status(400).json({ error: 'Google credentials not configured' });

    const redirectUri = resolveRedirectUri(req) || stateRedirectUri || getGoogleRedirectUri();
    const oauth2 = createOAuthClient(config, redirectUri);
    const { tokens } = await oauth2.getToken({ code, redirect_uri: redirectUri });
    if (!tokens.refresh_token) {
      return res.status(400).json({
        error: 'No refresh token received. Revoke app access in Google Account and connect again.',
      });
    }

    oauth2.setCredentials(tokens);

    let channelTitle = null;
    try {
      const youtube = google.youtube({ version: 'v3', auth: oauth2 });
      const channels = await youtube.channels.list({ part: ['snippet'], mine: true });
      channelTitle = channels.data.items?.[0]?.snippet?.title || null;
    } catch {
      /* optional */
    }

    await saveIntegration(teamId, tokens, {
      channel_title: channelTitle,
      connected_by: user.email,
      connected_at: new Date().toISOString(),
    });

    return res.status(200).json({ ok: true, connected: true, teamId, channelTitle });
  } catch (err) {
    console.error('oauth-token', err);
    return res.status(500).json({ error: err.message || 'Token exchange failed' });
  }
}
