/** Whether a card can show the one-click YouTube publish action. */
export function isReadyToPublish(item) {
  if (!item) return false;
  if (item.youtube_video_id || item.upload_status === 'uploaded') return false;
  if (item.upload_status === 'uploading') return false;
  return item.upload_status === 'ready' || !!item.drive_final_file_id;
}

export function publishStatusLabel(item) {
  if (item.youtube_video_id || item.upload_status === 'uploaded') {
    return { label: 'On YouTube', variant: 'success' };
  }
  if (item.upload_status === 'uploading') {
    return { label: 'Uploading…', variant: 'loading' };
  }
  if (item.upload_status === 'failed') {
    return { label: 'Upload failed', variant: 'error' };
  }
  if (isReadyToPublish(item)) {
    return { label: 'Ready to publish', variant: 'ready' };
  }
  if (item.drive_folder_id) {
    return { label: 'Awaiting final in Drive', variant: 'muted' };
  }
  return null;
}
