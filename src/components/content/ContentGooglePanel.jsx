import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Youtube, FolderOpen, Upload, Loader2, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { googleApiClient } from '@/api/google';
import { api } from '@/api/client';
import { useWorkspace } from '@/lib/workspace.jsx';
import { useAuth } from '@/lib/AuthContext';
import { canAttemptPublish, isReadyToPublish, publishStatusLabel } from '@/lib/publish';
import { logActivity } from '@/lib/activity';

export default function ContentGooglePanel({ contentItem, organizationId }) {
  const { user } = useAuth();
  const { hasPermission } = useWorkspace();
  const queryClient = useQueryClient();
  const isOwner = hasPermission(['owner']);
  const canPublish = hasPermission(['owner', 'manager']);

  const [uploadTitle, setUploadTitle] = useState(contentItem?.title || '');
  const [privacy, setPrivacy] = useState('private');
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState(
    () => new Set(contentItem?.drive_shared_with || [])
  );

  const { data: status } = useQuery({
    queryKey: ['google-status', organizationId],
    queryFn: () => googleApiClient.getStatus(organizationId),
    enabled: !!organizationId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['team-members-google', organizationId],
    queryFn: () =>
      api.entities.OrganizationMember.filter({ organization_id: organizationId }),
    enabled: !!organizationId && isOwner,
  });

  const connected = status?.connected;

  useEffect(() => {
    if (status?.publishing?.defaultPrivacy) {
      setPrivacy(status.publishing.defaultPrivacy);
    }
  }, [status?.publishing?.defaultPrivacy]);

  const myEmail = user?.email?.toLowerCase();
  const driveAllowed =
    isOwner ||
    !contentItem?.drive_shared_with?.length ||
    contentItem.drive_shared_with.some((e) => e.toLowerCase() === myEmail);

  const statusInfo = publishStatusLabel(contentItem, {
    googleConnected: connected,
    canPublish,
  });
  const ready = isReadyToPublish(contentItem);
  const canPublishNow = canAttemptPublish(contentItem);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['content-item', contentItem.id] });
    queryClient.invalidateQueries({ queryKey: ['content', organizationId] });
  };

  useEffect(() => {
    if (!connected || !organizationId) return;
    googleApiClient.scanDrive(organizationId).then(() => invalidate());
  }, [connected, organizationId, contentItem?.id, queryClient]);

  const handleScan = async () => {
    setScanning(true);
    try {
      await googleApiClient.scanDrive(organizationId);
      invalidate();
      toast.success('Checked Drive folder');
    } catch (err) {
      toast.error(err.message || 'Drive check failed');
    } finally {
      setScanning(false);
    }
  };

  const handlePublishFromDrive = async () => {
    setUploading(true);
    try {
      const result = await googleApiClient.publishFromDrive({
        teamId: organizationId,
        contentItemId: contentItem.id,
        title: uploadTitle || contentItem.title,
        description: contentItem.description || '',
        privacyStatus: privacy,
      });
      await logActivity({
        organizationId,
        contentItemId: contentItem.id,
        action: 'published',
        entityType: 'content',
        details: `Published "${contentItem.title}" to YouTube from Drive`,
      });
      toast.success('Published to YouTube');
      invalidate();
      if (result.videoUrl) window.open(result.videoUrl, '_blank');
    } catch (err) {
      toast.error(err.message || 'Publish failed');
      invalidate();
    } finally {
      setUploading(false);
    }
  };

  const handleCreateDriveFolder = async () => {
    setCreatingFolder(true);
    try {
      const emails = [...selectedEmails];
      const result = await googleApiClient.createDriveFolder({
        teamId: organizationId,
        contentItemId: contentItem.id,
        folderName: `${contentItem.title} — assets`,
        shareWithEmails: emails,
      });
      await api.entities.ContentItem.update(contentItem.id, {
        drive_folder_url: result.folderUrl,
        drive_folder_id: result.folderId,
        drive_shared_with: result.sharedWith,
      });
      toast.success('Drive folder created');
      invalidate();
    } catch (err) {
      toast.error(err.message || 'Could not create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  const toggleMember = (email) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  if (!connected) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs text-muted-foreground">
          {isOwner
            ? 'Connect Google in Settings → Integrations to enable YouTube uploads and Drive folders.'
            : 'Google is not connected for this workspace yet. Ask the owner to set it up in Settings.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-5">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Google integrations
      </h3>

      {canPublish && (
        <div className="space-y-3 border-b border-border pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Youtube className="w-4 h-4 text-red-400" />
              YouTube
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleScan} disabled={scanning}>
              {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
              Check Drive
            </Button>
          </div>

          {statusInfo && (
            <p className="text-xs text-muted-foreground">
              {statusInfo.label}
              {contentItem.drive_final_file_name ? ` · ${contentItem.drive_final_file_name}` : ''}
            </p>
          )}

          {!contentItem.youtube_video_url && (
            <>
              <p className="text-xs text-muted-foreground">
                Drop your export in the linked Drive folder (name it final.mp4). Publishing streams from Drive — no file picker.
              </p>
              <div>
                <Label className="text-xs">Title</Label>
                <Input
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Visibility</Label>
                <Select value={privacy} onValueChange={setPrivacy}>
                  <SelectTrigger className="mt-1 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="unlisted">Unlisted</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                onClick={handlePublishFromDrive}
                disabled={uploading || !canPublishNow}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Publish from Drive
              </Button>
              {canPublishNow && !ready && (
                <p className="text-[10px] text-muted-foreground">
                  No final detected yet — add final.mp4 to the folder, then tap Check Drive.
                </p>
              )}
              {!canPublishNow && (
                <p className="text-[10px] text-muted-foreground">
                  Create a Drive folder below before publishing.
                </p>
              )}
            </>
          )}

          {contentItem.youtube_video_url && (
            <a
              href={contentItem.youtube_video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-red-400 hover:underline"
            >
              View on YouTube
            </a>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FolderOpen className="w-4 h-4 text-blue-400" />
          Google Drive
        </div>

        {contentItem.drive_folder_url && driveAllowed ? (
          <a
            href={contentItem.drive_folder_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:underline block"
          >
            Open Drive folder
          </a>
        ) : contentItem.drive_folder_url && !driveAllowed ? (
          <p className="text-xs text-muted-foreground">
            Drive folder exists but you were not granted access. Ask the owner to share with your email.
          </p>
        ) : isOwner ? (
          <>
            <p className="text-xs text-muted-foreground">
              Folders are also created automatically when a card reaches Editing (if enabled in Integrations).
            </p>
            {members.length > 0 && (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                <p className="text-xs flex items-center gap-1 text-muted-foreground">
                  <Users className="w-3 h-3" /> Share with
                </p>
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={selectedEmails.has(m.user_email)}
                      onCheckedChange={() => toggleMember(m.user_email)}
                    />
                    {m.user_name || m.user_email}
                  </label>
                ))}
              </div>
            )}
            <Button size="sm" variant="outline" onClick={handleCreateDriveFolder} disabled={creatingFolder}>
              {creatingFolder ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FolderOpen className="w-4 h-4 mr-2" />
              )}
              Create & share folder
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No Drive folder linked yet.</p>
        )}

        {contentItem.drive_shared_with?.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Shared with: {contentItem.drive_shared_with.join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
