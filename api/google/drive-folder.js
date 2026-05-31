import { google } from 'googleapis';
import { getUserFromBearer, assertTeamOwner, getAdminClient } from '../_lib/supabase.js';
import { getAuthorizedClient } from '../_lib/google.js';
import { mergeContentMeta } from '../_lib/content-meta.js';
import { PIPELINE_IN_PRODUCTION, pipelineStageToDbStatus } from '../_lib/pipeline-stages.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromBearer(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { teamId, contentItemId, folderName, shareWithEmails = [] } = req.body || {};
    if (!teamId || !contentItemId) {
      return res.status(400).json({ error: 'teamId and contentItemId are required' });
    }

    if (!(await assertTeamOwner(user.id, teamId))) {
      return res.status(403).json({ error: 'Only owners can create Drive folders' });
    }

    const auth = await getAuthorizedClient(teamId);
    const drive = google.drive({ version: 'v3', auth });

    const { data: folder } = await drive.files.create({
      requestBody: {
        name: folderName || 'Creator Ops content',
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id, webViewLink',
    });

    const emails = [...new Set(shareWithEmails.filter(Boolean))];
    for (const email of emails) {
      try {
        await drive.permissions.create({
          fileId: folder.id,
          requestBody: {
            type: 'user',
            role: 'writer',
            emailAddress: email,
          },
          sendNotificationEmail: true,
        });
      } catch (permErr) {
        console.warn('drive permission', email, permErr.message);
      }
    }

    const admin = getAdminClient();
    const { data: existing } = await admin
      .from('content_items')
      .select('description')
      .eq('id', contentItemId)
      .single();

    const descriptionPayload = mergeContentMeta(existing?.description, {
      drive_folder_id: folder.id,
      drive_folder_url: folder.webViewLink,
      drive_shared_with: emails,
      pipeline_stage: PIPELINE_IN_PRODUCTION,
    });

    const { error: updateError } = await admin
      .from('content_items')
      .update({
        description: descriptionPayload,
        content_url: folder.webViewLink,
        platform: 'google-drive',
        platform_id: folder.id,
        status: pipelineStageToDbStatus(PIPELINE_IN_PRODUCTION),
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentItemId)
      .eq('team_id', teamId);

    if (updateError) throw updateError;

    return res.status(200).json({
      folderId: folder.id,
      folderUrl: folder.webViewLink,
      sharedWith: emails,
    });
  } catch (err) {
    console.error('drive-folder', err);
    return res.status(500).json({ error: err.message || 'Drive folder failed' });
  }
}
