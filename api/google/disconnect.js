import { getUserFromBearer, assertTeamOwner, getAdminClient } from '../_lib/supabase.js';
import { GOOGLE_SERVICE_NAME } from '../_lib/google.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromBearer(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { teamId } = req.body || {};
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    if (!(await assertTeamOwner(user.id, teamId))) {
      return res.status(403).json({ error: 'Owner only' });
    }

    const admin = getAdminClient();
    const { error } = await admin
      .from('integrations')
      .delete()
      .eq('team_id', teamId)
      .eq('service_name', GOOGLE_SERVICE_NAME);

    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('disconnect', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
