import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/lib/workspace.jsx';
import { Play, ArrowRight, Users, Building2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function Onboarding() {
  const navigate = useNavigate();
  const { createOrg, joinOrg, acceptInvite, getPendingInvites } = useWorkspace();
  const [tab, setTab] = useState('create');
  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [joinSlug, setJoinSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(true);

  useEffect(() => {
    getPendingInvites()
      .then(setPendingInvites)
      .finally(() => setLoadingInvites(false));
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const slug =
        form.slug ||
        form.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      await createOrg({ name: form.name, slug, description: form.description });
      toast.success('Workspace created');
      navigate('/', { replace: true });
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Could not create workspace');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    setJoining(true);
    try {
      await joinOrg({ slug: joinSlug });
      toast.success('Joined workspace');
      navigate('/', { replace: true });
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Could not join workspace');
    } finally {
      setJoining(false);
    }
  };

  const handleAcceptInvite = async (notificationId, organizationId) => {
    setJoining(true);
    try {
      await acceptInvite(notificationId, organizationId);
      toast.success('Joined workspace');
      navigate('/', { replace: true });
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Could not accept invitation');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/20 mb-4">
            <Play className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome to Creator Ops</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a new workspace or join an existing team
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="create" className="gap-2">
                <Building2 className="w-4 h-4" />
                Create
              </TabsTrigger>
              <TabsTrigger value="join" className="gap-2">
                <Users className="w-4 h-4" />
                Join
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4 mt-0">
              <div>
                <Label>Workspace name</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                      slug: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/(^-|-$)/g, ''),
                    })
                  }
                  placeholder="e.g. My YouTube Team"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Workspace slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="my-youtube-team"
                  className="mt-1 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Teammates use this slug to join your workspace
                </p>
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What does your team create?"
                  className="mt-1 h-20"
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={creating || !form.name.trim()}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {creating ? 'Setting up...' : 'Create workspace'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </TabsContent>

            <TabsContent value="join" className="space-y-4 mt-0">
              {!loadingInvites && pendingInvites.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Pending invitations
                  </Label>
                  {pendingInvites.map(({ notificationId, invite, org }) => (
                    <div
                      key={notificationId}
                      className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-muted/30"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{org.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          Invited as {invite.role}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={joining}
                        onClick={() => handleAcceptInvite(notificationId, org.id)}
                      >
                        Accept
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <Label>Workspace slug</Label>
                <Input
                  value={joinSlug}
                  onChange={(e) => setJoinSlug(e.target.value)}
                  placeholder="e.g. my-youtube-team"
                  className="mt-1 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Ask your team owner for the workspace slug
                </p>
              </div>

              <Button
                onClick={handleJoin}
                disabled={joining || !joinSlug.trim()}
                variant="secondary"
                className="w-full"
              >
                {joining ? 'Joining...' : 'Join workspace'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </div>
  );
}
