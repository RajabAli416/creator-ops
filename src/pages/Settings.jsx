import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useWorkspace } from '@/lib/workspace.jsx';
import { Building2, Plus, Trash2, Save, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import GoogleIntegrationsSettings from '@/components/integrations/GoogleIntegrationsSettings';
import ChatPermissionsSettings from '@/components/chat/ChatPermissionsSettings';
import { useGoogleConnection } from '@/hooks/useGoogleConnection';
import { toast } from 'sonner';

export default function Settings() {
  const { currentOrg, createOrg, refreshWorkspaces, hasPermission } = useWorkspace();
  const isOwner = hasPermission(['owner']);
  const { connected: googleConnected, refetch: refetchGoogle } = useGoogleConnection(
    isOwner ? currentOrg?.id : null
  );
  const [tab, setTab] = useState('general');
  const [orgForm, setOrgForm] = useState({ name: '', description: '' });
  const [newOrgForm, setNewOrgForm] = useState({ name: '', slug: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  // Read tab from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'workspace') setTab('workspace');
    if (tabParam === 'integrations') setTab('integrations');
    if (tabParam === 'chat') setTab('chat');
  }, []);

  useEffect(() => {
    if (tab === 'integrations' && isOwner) {
      refetchGoogle();
    }
  }, [tab, isOwner, refetchGoogle]);

  useEffect(() => {
    if (currentOrg) {
      setOrgForm({ name: currentOrg.name, description: currentOrg.description || '' });
    }
  }, [currentOrg]);

  const handleSave = async () => {
    if (!currentOrg) return;
    setSaving(true);
    await api.entities.Organization.update(currentOrg.id, {
      name: orgForm.name,
      description: orgForm.description,
    });
    await refreshWorkspaces();
    setSaving(false);
    toast.success('Workspace updated');
  };

  const handleCreateOrg = async () => {
    if (!newOrgForm.name.trim() || !newOrgForm.slug.trim()) return;
    setCreating(true);
    await createOrg({
      name: newOrgForm.name,
      slug: newOrgForm.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      description: newOrgForm.description,
    });
    setNewOrgForm({ name: '', slug: '', description: '' });
    setCreating(false);
    toast.success('Workspace created!');
  };

  const handleDeleteOrg = async () => {
    if (!currentOrg) return;
    if (!confirm('Are you sure? This will delete the workspace and all its data.')) return;
    
    // Delete all related data
    const members = await api.entities.OrganizationMember.filter({ organization_id: currentOrg.id });
    const content = await api.entities.ContentItem.filter({ organization_id: currentOrg.id });
    const tasks = await api.entities.Task.filter({ organization_id: currentOrg.id });
    const activities = await api.entities.ActivityLog.filter({ organization_id: currentOrg.id });
    
    for (const m of members) await api.entities.OrganizationMember.delete(m.id);
    for (const c of content) await api.entities.ContentItem.delete(c.id);
    for (const t of tasks) await api.entities.Task.delete(t.id);
    for (const a of activities) await api.entities.ActivityLog.delete(a.id);
    await api.entities.Organization.delete(currentOrg.id);
    
    await refreshWorkspaces();
    toast.success('Workspace deleted');
    window.location.href = '/';
  };

  const canEdit = hasPermission(['owner', 'manager']);
  const canManageChat = hasPermission(['owner', 'manager']);

  const handleCopySlug = () => {
    if (!currentOrg?.slug) return;
    navigator.clipboard.writeText(currentOrg.slug);
    toast.success('Workspace slug copied');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Settings" description="Manage your workspace" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="workspace">New Workspace</TabsTrigger>
          {canManageChat && <TabsTrigger value="chat">Chat</TabsTrigger>}
          {isOwner && (
            <TabsTrigger value="integrations" className="gap-1.5">
              Integrations
              {googleConnected && (
                <span
                  className="w-2 h-2 rounded-full bg-emerald-400"
                  title="Google connected"
                  aria-hidden
                />
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general">
          {currentOrg ? (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Workspace Settings</h2>
                </div>
                <div>
                  <Label>Name</Label>
                  <Input
                    value={orgForm.name}
                    onChange={e => setOrgForm({ ...orgForm, name: e.target.value })}
                    className="mt-1"
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={orgForm.description}
                    onChange={e => setOrgForm({ ...orgForm, description: e.target.value })}
                    className="mt-1 h-20"
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <Label>Workspace slug</Label>
                  <p className="text-xs text-muted-foreground mb-1">
                    Teammates use this slug to join your workspace (Join tab on welcome screen)
                  </p>
                  <div className="flex gap-2 mt-1">
                    <Input readOnly value={currentOrg.slug || '—'} className="font-mono text-sm" />
                    {currentOrg.slug && (
                      <Button type="button" variant="outline" size="icon" onClick={handleCopySlug}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSave} disabled={saving}>
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                )}
              </div>

              {hasPermission(['owner']) && (
                <div className="bg-card border border-destructive/30 rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-destructive mb-2">Danger Zone</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Deleting this workspace will remove all content, tasks, and team data permanently.
                  </p>
                  <Button variant="destructive" size="sm" onClick={handleDeleteOrg}>
                    <Trash2 className="w-4 h-4 mr-2" />Delete Workspace
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No workspace selected. Create one in the "New Workspace" tab.</p>
          )}
        </TabsContent>

        <TabsContent value="chat">
          {currentOrg && canManageChat ? (
            <div className="bg-card border border-border rounded-xl p-6">
              <ChatPermissionsSettings />
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Only owners and managers can configure chat permissions.
            </p>
          )}
        </TabsContent>

        <TabsContent value="integrations">
          {currentOrg && hasPermission(['owner']) ? (
            <GoogleIntegrationsSettings teamId={currentOrg.id} />
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Only workspace owners can configure Google integrations.
            </p>
          )}
        </TabsContent>

        <TabsContent value="workspace">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Plus className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Create New Workspace</h2>
            </div>
            <div>
              <Label>Workspace Name</Label>
              <Input
                value={newOrgForm.name}
                onChange={e => setNewOrgForm({ 
                  ...newOrgForm, 
                  name: e.target.value,
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                })}
                placeholder="My Creator Team"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={newOrgForm.slug}
                onChange={e => setNewOrgForm({ ...newOrgForm, slug: e.target.value })}
                placeholder="my-creator-team"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">URL-friendly identifier</p>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={newOrgForm.description}
                onChange={e => setNewOrgForm({ ...newOrgForm, description: e.target.value })}
                placeholder="What's this workspace for?"
                className="mt-1 h-20"
              />
            </div>
            <Button onClick={handleCreateOrg} disabled={creating || !newOrgForm.name.trim() || !newOrgForm.slug.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              {creating ? 'Creating...' : 'Create Workspace'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}