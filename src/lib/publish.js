export function isPublished(item) {
  return !!(item?.youtube_video_id || item?.upload_status === 'uploaded');
}

/** Scan found a final video — show “ready” badge. */
export function isReadyToPublish(item) {
  if (!item || isPublished(item)) return false;
  if (item.upload_status === 'uploading') return false;
  return item.upload_status === 'ready' || !!item.drive_final_file_id;
}

/** Owner/manager can publish when a Drive folder exists (API picks the final file). */
export function canAttemptPublish(item) {
  if (!item || isPublished(item)) return false;
  if (item.upload_status === 'uploading') return false;
  return !!(item.drive_folder_id || item.drive_folder_url);
}

export function hasDriveFolder(item) {
  return !!(item?.drive_folder_id || item?.drive_folder_url);
}

export function publishStatusLabel(item, { googleConnected = false, canPublish = false } = {}) {
  if (isPublished(item)) {
    return { label: 'On YouTube', variant: 'success' };
  }
  if (item?.upload_status === 'uploading') {
    return { label: 'Uploading…', variant: 'loading' };
  }
  if (item?.upload_status === 'failed') {
    return { label: 'Upload failed', variant: 'error' };
  }
  if (isReadyToPublish(item)) {
    return { label: 'Ready to publish', variant: 'ready' };
  }
  if (hasDriveFolder(item)) {
    return { label: 'Awaiting final in Drive', variant: 'muted' };
  }
  if (canPublish && googleConnected) {
    return { label: 'Needs Drive folder', variant: 'muted' };
  }
  return null;
}
