import React, { useState } from 'react';
import { api } from '@/api/client';
import { useWorkspace, ROLE_CONFIG } from '@/lib/workspace.jsx';
import { logActivity } from '@/lib/activity';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, MoreHorizontal, Shield, Trash2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { ListSkeleton } from '@/components/shared/LoadingSkeleton';
import { toast } from 'sonner';

export default function Team() {
  const { currentOrg, currentMember, hasPermission } = useWorkspace();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', currentOrg?.id],
    queryFn: () => api.entities.OrganizationMember.filter({ organization_id: currentOrg.id }),
    enabled: !!currentOrg,
  });

  const canManage = hasPermission(['owner', 'manager']);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    
    // Check if already a member
    const existing = members.find(m => m.user_email === inviteEmail);
    if (existing) {
      toast.error('This user is already a member');
      setInviting(false);
      return;
    }

    await api.entities.OrganizationMember.create({
      organization_id: currentOrg.id,
      user_email: inviteEmail,
      user_name: inviteEmail.split('@')[0],
      role: inviteRole,
      status: 'invited',
    });

    await logActivity({
      organizationId: currentOrg.id,
      action: 'assigned',
      entityType: 'member',
      details: `Invited ${inviteEmail} as ${inviteRole}`,
    });

    toast.success(`Invited ${inviteEmail}`);
    setInviteEmail('');
    setInviting(false);
    setInviteOpen(false);
    queryClient.invalidateQueries({ queryKey: ['members', currentOrg?.id] });
  };

  const handleRoleChange = async (memberId, newRole) => {
    await api.entities.OrganizationMember.update(memberId, { role: newRole });
    queryClient.invalidateQueries({ queryKey: ['members', currentOrg?.id] });
    toast.success('Role updated');
  };

  const handleRemove = async (member) => {
    await api.entities.OrganizationMember.delete(member.id);
    await logActivity({
      organizationId: currentOrg.id,
      action: 'deleted',
      entityType: 'member',
      details: `Removed ${member.user_email} from the team`,
    });
    queryClient.invalidateQueries({ queryKey: ['members', currentOrg?.id] });
    toast.success('Member removed');
  };

  if (!currentOrg) return null;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Team" description={`${members.length} members in ${currentOrg.name}`}>
        {canManage && (
          <Button onClick={() => setInviteOpen(true)} className="bg-primary hover:bg-primary/90">
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Member
          </Button>
        )}
      </PageHeader>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members"
          description="Invite your team to start collaborating on content."
          actionLabel="Invite Member"
          onAction={() => setInviteOpen(true)}
        />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          {members.map(member => {
            const role = ROLE_CONFIG[member.role] || ROLE_CONFIG.viewer;
            const initials = member.user_name
              ? member.user_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
              : member.user_email?.[0]?.toUpperCase() || '?';
            const isCurrentUser = member.user_email === currentMember?.user_email;

            return (
              <div key={member.id} className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {member.user_name || member.user_email}
                    {isCurrentUser && <span className="text-xs text-muted-foreground ml-2">(you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" />{member.user_email}
                  </p>
                </div>
                <Badge variant="secondary" className={`${role.color} text-xs`}>
                  <Shield className="w-3 h-3 mr-1" />{role.label}
                </Badge>
                {member.status === 'invited' && (
                  <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30">Pending</Badge>
                )}
                {canManage && !isCurrentUser && member.role !== 'owner' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'owner').map(([key, cfg]) => (
                        <DropdownMenuItem key={key} onClick={() => handleRoleChange(member.id, key)}>
                          Change to {cfg.label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleRemove(member)} className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" />Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Email Address</Label>
              <Input
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
                className="mt-1"
                type="email"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'owner').map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? 'Inviting...' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}