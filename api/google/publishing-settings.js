import { getUserFromBearer, assertTeamOwner, assertTeamMember } from '../_lib/supabase.js';
import {
  getStoredIntegration,
  getPublishingSettings,
  savePublishingSettings,
  DEFAULT_PUBLISHING_SETTINGS,
} from '../_lib/google.js';

export default async function handler(req, res) {
  try {
    const user = await getUserFromBearer(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const teamId = req.method === 'GET' ? req.query?.teamId : req.body?.teamId;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    if (!(await assertTeamMember(user.id, teamId))) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    if (req.method === 'GET') {
      const integration = await getStoredIntegration(teamId);
      return res.status(200).json({
        publishing: getPublishingSettings(integration),
        defaults: DEFAULT_PUBLISHING_SETTINGS,
      });
    }

    if (req.method === 'POST') {
      if (!(await assertTeamOwner(user.id, teamId))) {
        return res.status(403).json({ error: 'Only owners can change publishing settings' });
      }

      const { defaultPrivacy, autoCreateDriveFolder } = req.body || {};
      const patch = {};
      if (defaultPrivacy != null) patch.defaultPrivacy = defaultPrivacy;
      if (autoCreateDriveFolder != null) patch.autoCreateDriveFolder = !!autoCreateDriveFolder;

      const publishing = await savePublishingSettings(teamId, patch);
      return res.status(200).json({ publishing });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('publishing-settings', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
