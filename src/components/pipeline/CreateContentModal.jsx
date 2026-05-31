import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useWorkspace, PRIORITY_CONFIG } from '@/lib/workspace.jsx';
import { logActivity } from '@/lib/activity';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function CreateContentModal({ open, onOpenChange, onCreated }) {
  const { currentOrg } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    assigned_members: [],
    labels: '',
  });

  useEffect(() => {
    if (currentOrg && open) {
      api.entities.OrganizationMember.filter({ organization_id: currentOrg.id })
        .then(setMembers);
    }
  }, [currentOrg, open]);

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setLoading(true);
    
    const maxOrder = 999;
    const item = await api.entities.ContentItem.create({
      organization_id: currentOrg.id,
      title: form.title,
      description: form.description,
      status: 'planned',
      priority: form.priority,
      due_date: form.due_date || undefined,
      assigned_members: form.assigned_members,
      labels: form.labels ? form.labels.split(',').map(l => l.trim()).filter(Boolean) : [],
      sort_order: maxOrder,
    });

    await logActivity({
      organizationId: currentOrg.id,
      contentItemId: item.id,
      action: 'created',
      entityType: 'content',
      details: `Created content "${form.title}"`,
    });

    setForm({ title: '', description: '', priority: 'medium', due_date: '', assigned_members: [], labels: '' });
    setLoading(false);
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Content</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. 10 Tips for Better Videos"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Brief or notes..."
              className="mt-1 h-20"
            />
          </div>

          <div>
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1.5">
              New cards start in Planned. Stages update automatically from Drive and YouTube.
            </p>
          </div>

          <div>
            <Label>Due Date</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={e => setForm({ ...form, due_date: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Labels (comma-separated)</Label>
            <Input
              value={form.labels}
              onChange={e => setForm({ ...form, labels: e.target.value })}
              placeholder="tutorial, vlog, collab"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Assign Members</Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {members.map(m => {
                const selected = form.assigned_members.includes(m.user_email);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setForm(f => ({
                        ...f,
                        assigned_members: selected
                          ? f.assigned_members.filter(e => e !== m.user_email)
                          : [...f.assigned_members, m.user_email]
                      }));
                    }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      selected
                        ? 'bg-primary/20 border-primary/40 text-primary'
                        : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {m.user_name || m.user_email}
                  </button>
                );
              })}
              {members.length === 0 && (
                <p className="text-xs text-muted-foreground">No team members yet</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !form.title.trim()}>
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}