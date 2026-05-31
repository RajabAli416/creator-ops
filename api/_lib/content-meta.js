/** Parse / merge JSON description payload used by content_items. */

export function parseContentMeta(description) {
  if (!description) {
    return { text: '', meta: {} };
  }
  try {
    const parsed = JSON.parse(description);
    if (parsed && typeof parsed === 'object' && parsed._meta) {
      return { text: parsed.text || '', meta: { ...parsed._meta } };
    }
  } catch {
    /* plain text */
  }
  return { text: description, meta: {} };
}

export function mergeContentMeta(description, metaPatch) {
  const { text, meta } = parseContentMeta(description);
  const nextMeta = { ...meta, ...metaPatch };
  const hasMeta = Object.keys(nextMeta).some((k) => nextMeta[k] != null && nextMeta[k] !== '');
  if (!hasMeta && !text) return null;
  if (!hasMeta) return text || null;
  return JSON.stringify({ _meta: nextMeta, text });
}

/** Folder id/url may live in JSON meta or legacy platform columns. */
export function resolveDriveFolder(row, meta = null) {
  const parsed = meta ?? parseContentMeta(row?.description).meta;
  const fromPlatform = row?.platform === 'google-drive' ? row.platform_id : null;
  const fromUrl = row?.platform === 'google-drive' ? row.content_url : null;
  return {
    folderId: parsed.drive_folder_id || fromPlatform || null,
    folderUrl: parsed.drive_folder_url || fromUrl || null,
    sharedWith: parsed.drive_shared_with || [],
  };
}

/** Keep drive folder fields when patching other meta (scan was wiping these). */
export function withDriveFolderMeta(metaPatch, row, meta) {
  const { folderId, folderUrl, sharedWith } = resolveDriveFolder(row, meta);
  const patch = { ...metaPatch };
  if (folderId) patch.drive_folder_id = folderId;
  if (folderUrl) patch.drive_folder_url = folderUrl;
  if (sharedWith.length) patch.drive_shared_with = sharedWith;
  return patch;
}

