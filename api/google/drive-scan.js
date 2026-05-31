import { google } from 'googleapis';
import { getUserFromBearer, assertTeamMember, getAdminClient } from '../_lib/supabase.js';
import { getAuthorizedClient, getStoredIntegration, getPublishingSettings } from '../_lib/google.js';
import {
  parseContentMeta,
  mergeContentMeta,
  resolveDriveFolder,
  withDriveFolderMeta,
} from '../_lib/content-meta.js';
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

async function refetchItem(admin, itemId, teamId) {
  const { data, error } = await admin
    .from('content_items')
    .select('id, title, description, platform, platform_id, content_url, status')
    .eq('id', itemId)
    .eq('team_id', teamId)
    .single();
  if (error) throw error;
  return data;
}

async function persistItemUpdate(admin, itemId, teamId, payload) {
  const { error } = await admin
    .from('content_items')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('team_id', teamId);
  if (error) throw error;
}

async function ensureDriveFolder(drive, admin, item, teamId, publishing) {
  const fresh = await refetchItem(admin, item.id, teamId);
  let { meta } = parseContentMeta(fresh.description);
  const stage = normalizePipelineStage(meta.pipeline_stage);
  const { folderId, folderUrl } = resolveDriveFolder(fresh, meta);

  if (folderId) {
    if (!meta.drive_folder_id) {
      const description = mergeContentMeta(
        fresh.description,
        withDriveFolderMeta({ pipeline_stage: PIPELINE_IN_PRODUCTION }, fresh, meta)
      );
      await persistItemUpdate(admin, fresh.id, teamId, {
        description,
        content_url: folderUrl || fresh.content_url,
        platform: 'google-drive',
        platform_id: folderId,
        status: pipelineStageToDbStatus(PIPELINE_IN_PRODUCTION),
      });
      meta = parseContentMeta(description).meta;
    }
    return { folderId, folderUrl, meta, created: false };
  }

  if (!publishing.autoCreateDriveFolder || !AUTO_FOLDER_STAGES.has(stage)) {
    return null;
  }

  const { data: folder } = await drive.files.create({
    requestBody: {
      name: `${fresh.title} — assets`,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id, webViewLink',
  });

  const description = mergeContentMeta(
    fresh.description,
    withDriveFolderMeta(
      {
        drive_folder_id: folder.id,
        drive_folder_url: folder.webViewLink,
        pipeline_stage: PIPELINE_IN_PRODUCTION,
      },
      fresh,
      meta
    )
  );

  await persistItemUpdate(admin, fresh.id, teamId, {
    description,
    content_url: folder.webViewLink,
    platform: 'google-drive',
    platform_id: folder.id,
    status: pipelineStageToDbStatus(PIPELINE_IN_PRODUCTION),
  });

  return {
    folderId: folder.id,
    folderUrl: folder.webViewLink,
    meta: {
      ...meta,
      drive_folder_id: folder.id,
      drive_folder_url: folder.webViewLink,
      pipeline_stage: PIPELINE_IN_PRODUCTION,
    },
    created: true,
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
      .select('id, title, description, platform, platform_id, content_url, status')
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
          await persistItemUpdate(admin, item.id, teamId, {
            description: mergeContentMeta(
              item.description,
              withDriveFolderMeta({ pipeline_stage: PIPELINE_PUBLISHED }, item, meta)
            ),
            status: 'published',
          });
        }
        results.push({
          contentItemId: item.id,
          uploadStatus: 'uploaded',
          pipelineStage: PIPELINE_PUBLISHED,
        });
        continue;
      }

      const folderResult = await ensureDriveFolder(drive, admin, item, teamId, publishing);
      let descriptionBase = item.description;
      if (folderResult) {
        meta = folderResult.meta;
        descriptionBase = mergeContentMeta(
          item.description,
          withDriveFolderMeta(
            {
              drive_folder_id: folderResult.folderId,
              drive_folder_url: folderResult.folderUrl,
              pipeline_stage: meta.pipeline_stage,
            },
            item,
            meta
          )
        );
      }

      const { folderId } = resolveDriveFolder(
        folderResult
          ? { ...item, platform: 'google-drive', platform_id: folderResult.folderId, content_url: folderResult.folderUrl }
          : item,
        meta
      );

      const metaPatch = {};

      if (folderId && meta.pipeline_stage === PIPELINE_PLANNED) {
        metaPatch.pipeline_stage = PIPELINE_IN_PRODUCTION;
      }

      if (!folderId) {
        await persistItemUpdate(admin, item.id, teamId, {
          description: mergeContentMeta(
            descriptionBase,
            withDriveFolderMeta(metaPatch, item, meta)
          ),
        });

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

      const stage = metaPatch.pipeline_stage || meta.pipeline_stage;
      const description = mergeContentMeta(
        descriptionBase,
        withDriveFolderMeta(metaPatch, item, meta)
      );

      await persistItemUpdate(admin, item.id, teamId, {
        description,
        status: pipelineStageToDbStatus(stage),
      });

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
