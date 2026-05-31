import { google } from 'googleapis';
import { getUserFromBearer, assertTeamPublisher, getAdminClient } from '../_lib/supabase.js';
import { getAuthorizedClient, getStoredIntegration, getPublishingSettings } from '../_lib/google.js';
import { parseContentMeta, mergeContentMeta } from '../_lib/content-meta.js';
import { listVideosInFolder, pickFinalVideo } from '../_lib/drive-final.js';
import { PIPELINE_PUBLISHED } from '../_lib/pipeline-stages.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromBearer(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const {
      teamId,
      contentItemId,
      title: titleOverride,
      description: descriptionOverride,
      privacyStatus: privacyOverride,
    } = req.body || {};

    if (!teamId || !contentItemId) {
      return res.status(400).json({ error: 'teamId and contentItemId are required' });
    }

    if (!(await assertTeamPublisher(user.id, teamId))) {
      return res.status(403).json({ error: 'Only owners and managers can publish to YouTube' });
    }

    const admin = getAdminClient();
    const { data: item, error: fetchError } = await admin
      .from('content_items')
      .select('*')
      .eq('id', contentItemId)
      .eq('team_id', teamId)
      .single();

    if (fetchError || !item) {
      return res.status(404).json({ error: 'Content item not found' });
    }

    const { text, meta } = parseContentMeta(item.description);
    if (meta.youtube_video_id || (item.platform === 'youtube' && item.platform_id)) {
      return res.status(400).json({ error: 'Already published to YouTube' });
    }

    const folderId = meta.drive_folder_id || (item.platform === 'google-drive' ? item.platform_id : null);
    if (!folderId) {
      return res.status(400).json({ error: 'No Drive folder linked to this content' });
    }

    const integration = await getStoredIntegration(teamId);
    const publishing = getPublishingSettings(integration);
    const auth = await getAuthorizedClient(teamId);
    const drive = google.drive({ version: 'v3', auth });
    const youtube = google.youtube({ version: 'v3', auth });

    let fileId = meta.drive_final_file_id;
    let fileName = meta.drive_final_file_name;
    let mimeType = 'video/mp4';

    if (!fileId) {
      const videos = await listVideosInFolder(drive, folderId);
      const finalFile = pickFinalVideo(videos);
      if (!finalFile) {
        return res.status(400).json({
          error: 'No final video found in Drive. Name your export final.mp4 or similar.',
        });
      }
      fileId = finalFile.id;
      fileName = finalFile.name;
      mimeType = finalFile.mimeType || 'video/mp4';
    } else {
      const { data: fileMeta } = await drive.files.get({
        fileId,
        fields: 'mimeType,name',
      });
      mimeType = fileMeta?.mimeType || mimeType;
      fileName = fileMeta?.name || fileName;
    }

    await admin
      .from('content_items')
      .update({
        description: mergeContentMeta(item.description, { upload_status: 'uploading' }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentItemId);

    const driveStream = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    const title = titleOverride || item.title;
    const description = descriptionOverride ?? text ?? '';
    const privacyStatus = privacyOverride || publishing.defaultPrivacy || 'private';

    const uploadRes = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title,
          description,
          tags: [],
        },
        status: {
          privacyStatus,
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        mimeType,
        body: driveStream.data,
      },
    });

    const videoId = uploadRes.data.id;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const descriptionPayload = mergeContentMeta(item.description, {
      pipeline_stage: PIPELINE_PUBLISHED,
      upload_status: 'uploaded',
      youtube_video_id: videoId,
      youtube_video_url: videoUrl,
      drive_final_file_id: fileId,
      drive_final_file_name: fileName,
    });

    const { error: updateError } = await admin
      .from('content_items')
      .update({
        title: title || item.title,
        description: descriptionPayload,
        content_url: videoUrl,
        platform: 'youtube',
        platform_id: videoId,
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentItemId)
      .eq('team_id', teamId);

    if (updateError) throw updateError;

    return res.status(200).json({
      videoId,
      videoUrl,
      driveFinalFileName: fileName,
    });
  } catch (err) {
    console.error('youtube-publish-from-drive', err);

    const { teamId, contentItemId } = req.body || {};
    if (teamId && contentItemId) {
      try {
        const admin = getAdminClient();
        const { data: item } = await admin
          .from('content_items')
          .select('description')
          .eq('id', contentItemId)
          .single();
        if (item) {
          await admin
            .from('content_items')
            .update({
              description: mergeContentMeta(item.description, {
                upload_status: 'failed',
              }),
              updated_at: new Date().toISOString(),
            })
            .eq('id', contentItemId);
        }
      } catch {
        /* best effort */
      }
    }

    return res.status(500).json({ error: err.message || 'YouTube publish failed' });
  }
}
