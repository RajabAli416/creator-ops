import { google } from 'googleapis';
import { getUserFromBearer, assertTeamMember, getAdminClient } from '../_lib/supabase.js';
import { getAuthorizedClient, getStoredIntegration, getPublishingSettings } from '../_lib/google.js';
import { parseContentMeta, mergeContentMeta } from '../_lib/content-meta.js';
import { listVideosInFolder, pickFinalVideo } from '../_lib/drive-final.js';
import {
  AUTO_FOLDER_STAGES,
  normalizePipelineStage,
  PIPELINE_IN_PRODUCTION,
  PIPELINE_PLANNED,
  PIPELINE_PUBLISHED,
  PIPELINE_READY,
  pipelineStageToDbStatus,
} from '../_lib/pipeline-stages.js';

async function ensureDriveFolder(drive, admin, item, teamId, publishing) {
  const { meta } = parseContentMeta(item.description);
  const stage = normalizePipelineStage(meta.pipeline_stage);
  if (meta.drive_folder_id || !publishing.autoCreateDriveFolder) return null;
  if (!AUTO_FOLDER_STAGES.has(stage)) return null;

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
    pipeline_stage: PIPELINE_IN_PRODUCTION,
  });

  await admin
    .from('content_items')
    .update({
      description,
      content_url: folder.webViewLink,
      platform: 'google-drive',
      platform_id: folder.id,
      status: pipelineStageToDbStatus(PIPELINE_IN_PRODUCTION),
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id)
    .eq('team_id', teamId);

  return {
    folderId: folder.id,
    folderUrl: folder.webViewLink,
    meta: {
      ...meta,
      drive_folder_id: folder.id,
      drive_folder_url: folder.webViewLink,
      pipeline_stage: PIPELINE_IN_PRODUCTION,
    },
  };
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
      meta.pipeline_stage = normalizePipelineStage(
        meta.pipeline_stage ||
          (item.status === 'published' ? PIPELINE_PUBLISHED : PIPELINE_PLANNED)
      );

      if (youtubeAlreadyPublished(meta, item)) {
        if (meta.pipeline_stage !== PIPELINE_PUBLISHED) {
          await admin
            .from('content_items')
            .update({
              description: mergeContentMeta(item.description, { pipeline_stage: PIPELINE_PUBLISHED }),
              status: 'published',
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);
        }
        results.push({
          contentItemId: item.id,
          uploadStatus: 'uploaded',
          pipelineStage: PIPELINE_PUBLISHED,
        });
        continue;
      }

      const folderCreated = await ensureDriveFolder(drive, admin, item, teamId, publishing);
      if (folderCreated) {
        meta = folderCreated.meta;
      }

      const folderId = meta.drive_folder_id;
      const metaPatch = {};

      if (folderId && meta.pipeline_stage === PIPELINE_PLANNED) {
        metaPatch.pipeline_stage = PIPELINE_IN_PRODUCTION;
      }

      if (!folderId) {
        await admin
          .from('content_items')
          .update({
            description: mergeContentMeta(item.description, metaPatch),
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)
          .eq('team_id', teamId);

        results.push({
          contentItemId: item.id,
          uploadStatus: 'pending',
          pipelineStage: metaPatch.pipeline_stage || meta.pipeline_stage,
        });
        continue;
      }

      const videos = await listVideosInFolder(drive, folderId);
      const finalFile = pickFinalVideo(videos);

      metaPatch.upload_status = finalFile ? 'ready' : 'pending';
      metaPatch.drive_final_file_id = finalFile?.id || null;
      metaPatch.drive_final_file_name = finalFile?.name || null;
      metaPatch.drive_ready_at = finalFile ? new Date().toISOString() : null;

      if (finalFile) {
        metaPatch.pipeline_stage = PIPELINE_READY;
      } else if (!metaPatch.pipeline_stage) {
        metaPatch.pipeline_stage = PIPELINE_IN_PRODUCTION;
      }

      const description = mergeContentMeta(item.description, metaPatch);
      const stage = metaPatch.pipeline_stage || meta.pipeline_stage;

      await admin
        .from('content_items')
        .update({
          description,
          status: pipelineStageToDbStatus(stage),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
        .eq('team_id', teamId);

      results.push({
        contentItemId: item.id,
        uploadStatus: metaPatch.upload_status,
        driveFinalFileId: finalFile?.id || null,
        driveFinalFileName: finalFile?.name || null,
        pipelineStage: stage,
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
