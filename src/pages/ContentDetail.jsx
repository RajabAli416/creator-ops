import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useWorkspace, PIPELINE_STAGES, PRIORITY_CONFIG } from '@/lib/workspace.jsx';
import { logActivity } from '@/lib/activity';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowLeft, Calendar, Flag, Tag, Youtube, FolderOpen,
  CheckSquare, Plus, MoreHorizontal, Trash2, Edit2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import ContentDetailTasks from '@/components/content/ContentDetailTasks';
import { Skeleton } from '@/components/ui/skeleton';

export default function ContentDetail() {
  const { id } = useParams();
  const { currentOrg } = useWorkspace();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  const { data: item, isLoading } = useQuery({
    queryKey: ['content-item', id],
    queryFn: async () => {
      const items = await api.entities.ContentItem.filter({ organization_id: currentOrg.id });
      return items.find(i => i.id === id);
    },
    enabled: !!currentOrg && !!id,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities', currentOrg?.id, id],
    queryFn: () => api.entities.ActivityLog.filter({ 
      organization_id: currentOrg.id, 
      content_item_id: id 
    }, '-created_date', 20),
    enabled: !!currentOrg && !!id,
  });

  const handleStatusChange = async (newStatus) => {
    const oldStage = PIPELINE_STAGES.find(s => s.id === item.status);
    const newStage = PIPELINE_STAGES.find(s => s.id === newStatus);
    await api.entities.ContentItem.update(id, { status: newStatus });
    await logActivity({
      organizationId: currentOrg.id,
      contentItemId: id,
      action: 'moved',
      entityType: 'content',
      details: `Moved "${item.title}" from ${oldStage?.label} to ${newStage?.label}`,
    });
    queryClient.invalidateQueries({ queryKey: ['content-item', id] });
    queryClient.invalidateQueries({ queryKey: ['content', currentOrg?.id] });
  };

  const handleSaveEdit = async () => {
    await api.entities.ContentItem.update(id, {
      ...editForm,
      labels: typeof editForm.labels === 'string' 
        ? editForm.labels.split(',').map(l => l.trim()).filter(Boolean)
        : editForm.labels,
    });
    await logActivity({
      organizationId: currentOrg.id,
      contentItemId: id,
      action: 'updated',
      entityType: 'content',
      details: `Updated "${editForm.title || item.title}"`,
    });
    setEditing(false);
    queryClient.invalidateQueries({ queryKey: ['content-item', id] });
  };

  const handleDelete = async () => {
    await api.entities.ContentItem.delete(id);
    await logActivity({
      organizationId: currentOrg.id,
      action: 'deleted',
      entityType: 'content',
      details: `Deleted "${item.title}"`,
    });
    window.location.href = '/pipeline';
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Content not found</p>
        <Link to="/pipeline" className="text-primary text-sm mt-2 inline-block">Back to Pipeline</Link>
      </div>
    );
  }

  const stage = PIPELINE_STAGES.find(s => s.id === item.status);
  const priority = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.medium;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back link */}
      <Link to="/pipeline" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Pipeline
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1">
          {editing ? (
            <Input
              value={editForm.title || ''}
              onChange={e => setEditForm({ ...editForm, title: e.target.value })}
              className="text-xl font-bold"
            />
          ) : (
            <h1 className="text-2xl font-bold text-foreground">{item.title}</h1>
          )}
          <div className="flex items-center flex-wrap gap-2 mt-2">
            <Badge className={`${stage?.color} border`}>{stage?.label}</Badge>
            <Badge variant="secondary" className={priority.color}>
              <Flag className="w-3 h-3 mr-1" />{priority.label}
            </Badge>
            {item.labels?.map((label, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                <Tag className="w-3 h-3 mr-1" />{label}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveEdit}>Save</Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => { setEditing(true); setEditForm({ ...item, labels: item.labels?.join(', ') || '' }); }}>
                <Edit2 className="w-3.5 h-3.5 mr-1.5" />Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3">Description</h3>
            {editing ? (
              <Textarea
                value={editForm.description || ''}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                className="h-32"
              />
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {item.description || 'No description yet.'}
              </p>
            )}
          </div>

          {/* Tasks */}
          <ContentDetailTasks contentItemId={id} organizationId={currentOrg.id} />

          {/* Activity */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold">Activity</h3>
            </div>
            <div className="p-3 max-h-72 overflow-y-auto">
              <ActivityFeed activities={activities} />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Stage</h3>
            <Select value={item.status} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Details */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</h3>
            
            {item.due_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{format(new Date(item.due_date), 'MMM d, yyyy')}</span>
              </div>
            )}

            {item.assigned_members?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Assigned</p>
                <div className="flex flex-wrap gap-1.5">
                  {item.assigned_members.map((email, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs bg-secondary rounded-full px-2 py-0.5">
                      <Avatar className="w-4 h-4">
                        <AvatarFallback className="text-[8px]">{email[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {email}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Links */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Links</h3>
            {item.youtube_video_url ? (
              <a href={item.youtube_video_url} target="_blank" rel="noopener noreferrer" 
                className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors">
                <Youtube className="w-4 h-4" />YouTube Video
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">No YouTube link</p>
            )}
            {item.drive_folder_url ? (
              <a href={item.drive_folder_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                <FolderOpen className="w-4 h-4" />Drive Folder
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">No Drive folder</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}