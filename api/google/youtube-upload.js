import { google } from 'googleapis';
import { getUserFromBearer, assertTeamOwner, getAdminClient } from '../_lib/supabase.js';
import { getAuthorizedClient } from '../_lib/google.js';

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
      title,
      description,
      privacyStatus = 'private',
      tags = [],
      fileBase64,
      mimeType = 'video/mp4',
    } = req.body || {};

    if (!teamId || !contentItemId || !title || !fileBase64) {
      return res.status(400).json({
        error: 'teamId, contentItemId, title, and fileBase64 are required',
      });
    }

    if (!(await assertTeamOwner(user.id, teamId))) {
      return res.status(403).json({ error: 'Only owners can upload to YouTube' });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    const maxBytes = 48 * 1024 * 1024;
    if (buffer.length > maxBytes) {
      return res.status(413).json({
        error: 'Video must be under 48MB for server upload. Use a smaller file or compress first.',
      });
    }

    const auth = await getAuthorizedClient(teamId);
    const youtube = google.youtube({ version: 'v3', auth });

    const uploadRes = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title,
          description: description || '',
          tags: Array.isArray(tags) ? tags : [],
        },
        status: {
          privacyStatus,
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        mimeType,
        body: buffer,
      },
    });

    const videoId = uploadRes.data.id;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const admin = getAdminClient();
    const { data: existing } = await admin
      .from('content_items')
      .select('description')
      .eq('id', contentItemId)
      .single();

    let descriptionPayload = existing?.description;
    try {
      const parsed = JSON.parse(descriptionPayload || '{}');
      if (parsed?._meta) {
        parsed._meta.youtube_video_id = videoId;
        parsed._meta.youtube_video_url = videoUrl;
        descriptionPayload = JSON.stringify(parsed);
      }
    } catch {
      /* plain text */
    }

    const { error: updateError } = await admin
      .from('content_items')
      .update({
        title: title || undefined,
        description: descriptionPayload,
        content_url: videoUrl,
        platform: 'youtube',
        platform_id: videoId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentItemId)
      .eq('team_id', teamId);

    if (updateError) throw updateError;

    return res.status(200).json({
      videoId,
      videoUrl,
    });
  } catch (err) {
    console.error('youtube-upload', err);
    return res.status(500).json({ error: err.message || 'YouTube upload failed' });
  }
}
