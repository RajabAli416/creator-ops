import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Flag, Youtube, FolderOpen, Loader2, Upload, ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PRIORITY_CONFIG } from '@/lib/workspace.jsx';
import { isReadyToPublish, publishStatusLabel } from '@/lib/publish';
import { googleApiClient } from '@/api/google';
import { logActivity } from '@/lib/activity';
import { format, isPast, isToday } from 'date-fns';
import { toast } from 'sonner';

const STATUS_STYLES = {
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  ready: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  loading: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  error: 'bg-red-500/15 text-red-400 border-red-500/30',
  muted: 'bg-secondary text-muted-foreground border-border',
};

export default function ContentCard({
  item,
  organizationId,
  canPublish = false,
  onPublished,
}) {
  const navigate = useNavigate();
  const [publishing, setPublishing] = useState(false);
  const priority = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.medium;
  const isOverdue = item.due_date && isPast(new Date(item.due_date)) && !isToday(new Date(item.due_date));
  const assignees = item.assigned_members || [];
  const statusInfo = publishStatusLabel(item);
  const showPublish = canPublish && isReadyToPublish(item) && item.upload_status !== 'uploading';

  const openDetail = () => navigate(`/content/${item.id}`);

  const handlePublish = async (e) => {
    e.stopPropagation();
    if (!organizationId || publishing) return;
    setPublishing(true);
    try {
      const result = await googleApiClient.publishFromDrive({
        teamId: organizationId,
        contentItemId: item.id,
        title: item.title,
        description: item.description || '',
      });
      await logActivity({
        organizationId,
        contentItemId: item.id,
        action: 'published',
        entityType: 'content',
        details: `Published "${item.title}" to YouTube from Drive`,
      });
      toast.success('Published to YouTube');
      onPublished?.();
      if (result.videoUrl) window.open(result.videoUrl, '_blank');
    } catch (err) {
      toast.error(err.message || 'Publish failed');
      onPublished?.();
    } finally {
      setPublishing(false);
    }
  };

  const handleDriveLink = (e) => {
    e.stopPropagation();
    if (item.drive_folder_url) window.open(item.drive_folder_url, '_blank');
  };

  return (
    <div
      onClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetail();
        }
      }}
      role="button"
      tabIndex={0}
      className="bg-card border border-border rounded-lg p-3.5 cursor-pointer hover:border-primary/30 transition-all duration-200 group"
    >
      {statusInfo && (
        <div className="mb-2">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[statusInfo.variant]}`}
          >
            {statusInfo.variant === 'loading' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
            {statusInfo.variant === 'success' && <Youtube className="w-2.5 h-2.5" />}
            {statusInfo.label}
          </span>
          {item.drive_final_file_name && statusInfo.variant === 'ready' && (
            <p className="text-[10px] text-muted-foreground mt-1 truncate">{item.drive_final_file_name}</p>
          )}
        </div>
      )}

      {item.labels?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {item.labels.slice(0, 3).map((label, i) => (
            <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {label}
            </span>
          ))}
        </div>
      )}

      <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
        {item.title}
      </h4>

      {item.description && (
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{item.description}</p>
      )}

      {(showPublish || item.drive_folder_url || item.youtube_video_url) && (
        <div className="flex flex-wrap gap-1.5 mt-2.5" onClick={(e) => e.stopPropagation()}>
          {showPublish && (
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={publishing}
              onClick={handlePublish}
            >
              {publishing ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Upload className="w-3 h-3 mr-1" />
              )}
              Publish to YouTube
            </Button>
          )}
          {item.drive_folder_url && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleDriveLink}>
              <FolderOpen className="w-3 h-3 mr-1" />
              Drive
            </Button>
          )}
          {item.youtube_video_url && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
              <a href={item.youtube_video_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3 mr-1" />
                YouTube
              </a>
            </Button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/50">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 ${priority.color}`}>
            <Flag className="w-2.5 h-2.5 mr-1" />
            {priority.label}
          </Badge>
          {item.due_date && (
            <span
              className={`text-[10px] flex items-center gap-1 ${
                isOverdue ? 'text-red-400' : 'text-muted-foreground'
              }`}
            >
              <Calendar className="w-2.5 h-2.5" />
              {format(new Date(item.due_date), 'MMM d')}
            </span>
          )}
        </div>

        <div className="flex -space-x-1.5">
          {assignees.slice(0, 3).map((email, i) => (
            <Avatar key={i} className="w-5 h-5 border border-card">
              <AvatarFallback className="text-[8px] bg-secondary text-muted-foreground">
                {email[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
          {assignees.length > 3 && (
            <Avatar className="w-5 h-5 border border-card">
              <AvatarFallback className="text-[8px] bg-secondary text-muted-foreground">
                +{assignees.length - 3}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </div>
  );
}
