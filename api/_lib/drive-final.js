const MIN_VIDEO_BYTES = 10 * 1024 * 1024;
const FINAL_NAME_RE = /final/i;

export async function listVideosInFolder(drive, folderId) {
  const { data } = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false and mimeType contains 'video/'`,
    fields: 'files(id,name,mimeType,size,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 50,
  });
  return data?.files || [];
}

/** Prefer files named "final"; otherwise newest video over min size. */
export function pickFinalVideo(files) {
  const videos = (files || []).filter((f) => Number(f.size || 0) >= MIN_VIDEO_BYTES);
  if (!videos.length) return null;

  const namedFinal = videos.filter((f) => FINAL_NAME_RE.test(f.name || ''));
  const pool = namedFinal.length ? namedFinal : videos;
  return pool.sort(
    (a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0)
  )[0];
}
