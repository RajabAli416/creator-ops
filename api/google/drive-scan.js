import { google } from 'googleapis';
import { getUserFromBearer, assertTeamMember, getAdminClient } from '../_lib/supabase.js';
import { getAuthorizedClient, getStoredIntegration, getPublishingSettings } from '../_lib/google.js';
import { parseContentMeta, mergeContentMeta } from '../_lib/content-meta.js';
import { listVideosInFolder, pickFinalVideo } from '../_lib/drive-final.js';

const AUTO_FOLDER_STAGES = new Set(['editing', 'thumbnail', 'review', 'scheduled']);

async function ensureDriveFolder(drive, admin, item, teamId, publishing) {
  const { text, meta } = parseContentMeta(item.description);
  if (meta.drive_folder_id || !publishing.autoCreateDriveFolder) return null;
  if (!AUTO_FOLDER_STAGES.has(meta.pipeline_stage || 'idea')) return null;

  const { data: folder } = await drive.files.create({
    requestBody: {
      name: `${item.title} — assets`,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id, webViewLink',
  });

  const description = mergeContentMeta(item.description, {
    drive_folder_id: folder.id,
    drive_folder_url: folder.webViewLink,
    drive_shared_with: meta.drive_shared_with || [],
  });

  await admin
    .from('content_items')
    .update({
      description,
      content_url: folder.webViewLink,
      platform: 'google-drive',
      platform_id: folder.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id)
    .eq('team_id', teamId);

  return { folderId: folder.id, folderUrl: folder.webViewLink, text, meta: { ...meta, drive_folder_id: folder.id, drive_folder_url: folder.webViewLink } };
}

function youtubeAlreadyPublished(meta, row) {
  return !!(meta.youtube_video_id || (row.platform === 'youtube' && row.platform_id));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromBearer(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { teamId } = req.body || {};
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    if (!(await assertTeamMember(user.id, teamId))) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const integration = await getStoredIntegration(teamId);
    if (!integration?.refresh_token) {
      return res.status(200).json({ scanned: 0, results: [], connected: false });
    }

    const publishing = getPublishingSettings(integration);
    const auth = await getAuthorizedClient(teamId);
    const drive = google.drive({ version: 'v3', auth });
    const admin = getAdminClient();

    const { data: items, error } = await admin
      .from('content_items')
      .select('id, title, description, platform, platform_id, status')
      .eq('team_id', teamId);

    if (error) throw error;

    const results = [];

    for (const item of items || []) {
      let { meta } = parseContentMeta(item.description);
      if (!meta.pipeline_stage) {
        if (item.status === 'published') meta.pipeline_stage = 'published';
        else if (item.status === 'scheduled') meta.pipeline_stage = 'scheduled';
      }

      if (youtubeAlreadyPublished(meta, item)) {
        results.push({
          contentItemId: item.id,
          uploadStatus: 'uploaded',
          driveFinalFileId: meta.drive_final_file_id || null,
          driveFinalFileName: meta.drive_final_file_name || null,
        });
        continue;
      }

      const folderCreated = await ensureDriveFolder(drive, admin, item, teamId, publishing);
      if (folderCreated) {
        meta = folderCreated.meta;
        item.description = mergeContentMeta(item.description, {
          drive_folder_id: folderCreated.folderId,
          drive_folder_url: folderCreated.folderUrl,
        });
      }

      const folderId = meta.drive_folder_id;
      if (!folderId) {
        results.push({
          contentItemId: item.id,
          uploadStatus: 'pending',
          driveFinalFileId: null,
          driveFinalFileName: null,
        });
        continue;
      }

      const videos = await listVideosInFolder(drive, folderId);
      const finalFile = pickFinalVideo(videos);

      const uploadStatus = finalFile ? 'ready' : 'pending';
      const metaPatch = {
        upload_status: uploadStatus,
        drive_final_file_id: finalFile?.id || null,
        drive_final_file_name: finalFile?.name || null,
        drive_ready_at: finalFile ? new Date().toISOString() : null,
      };

      if (finalFile && !['review', 'scheduled', 'published'].includes(meta.pipeline_stage)) {
        metaPatch.pipeline_stage = 'review';
      }

      const description = mergeContentMeta(item.description, metaPatch);

      const dbPayload = {
        description,
        updated_at: new Date().toISOString(),
      };
      if (metaPatch.pipeline_stage) {
        dbPayload.status = metaPatch.pipeline_stage === 'published' ? 'published' : 'draft';
      }

      await admin
        .from('content_items')
        .update(dbPayload)
        .eq('id', item.id)
        .eq('team_id', teamId);

      results.push({
        contentItemId: item.id,
        uploadStatus,
        driveFinalFileId: finalFile?.id || null,
        driveFinalFileName: finalFile?.name || null,
        pipelineStage: metaPatch.pipeline_stage || meta.pipeline_stage,
      });
    }

    return res.status(200).json({
      scanned: results.length,
      results,
      connected: true,
    });
  } catch (err) {
    console.error('drive-scan', err);
    return res.status(500).json({ error: err.message || 'Drive scan failed' });
  }
}
