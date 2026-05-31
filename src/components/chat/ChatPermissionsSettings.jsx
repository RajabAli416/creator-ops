import React, { useMemo, useState } from 'react';
import { api } from '@/api/client';
import { useWorkspace } from '@/lib/workspace.jsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isPrivilegedChatRole } from '@/lib/chatDisplay';
import { ROLE_CONFIG } from '@/lib/workspace.jsx';

export default function ChatPermissionsSettings() {
  const { currentOrg, hasPermission } = useWorkspace();
  const queryClient = useQueryClient();
  const canManage = hasPermission(['owner', 'manager']);
  const [savingUserId, setSavingUserId] = useState(null);

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['members', currentOrg?.id],
    queryFn: () => api.entities.OrganizationMember.filter({ organization_id: currentOrg.id }),
    enabled: !!currentOrg && canManage,
  });

  const { data: permissions = [], isLoading: permsLoading } = useQuery({
    queryKey: ['chat-permissions', currentOrg?.id],
    queryFn: () => api.entities.ChatPermission.list(currentOrg.id),
    enabled: !!currentOrg && canManage,
  });

  const permissionByUserId = useMemo(
    () => Object.fromEntries(permissions.map((p) => [p.user_id, p])),
    [permissions]
  );

  const handleToggle = async (member, enabled) => {
    if (!currentOrg) return;
    setSavingUserId(member.user_id);
    try {
      await api.entities.ChatPermission.setGeneralChatEnabled(
        currentOrg.id,
        member.user_id,
        enabled
      );
      queryClient.invalidateQueries({ queryKey: ['chat-permissions', currentOrg.id] });
      toast.success(
        enabled
          ? `${member.user_name || member.user_email} can use general chat`
          : `General chat disabled for ${member.user_name || member.user_email}`
      );
    } catch (err) {
      toast.error(err.message || 'Could not update chat permission');
    } finally {
      setSavingUserId(null);
    }
  };

  if (!canManage) return null;

  const manageableMembers = members.filter((m) => !isPrivilegedChatRole(m.role));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">General chat access</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Owners and managers can always chat. Toggle whether other members can post in the
          workspace general chat. Direct messages with leadership are not affected.
        </p>
      </div>

      {membersLoading || permsLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : manageableMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No non-manager members to configure.</p>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {manageableMembers.map((member) => {
            const enabled = permissionByUserId[member.user_id]?.general_chat_enabled ?? true;
            const role = ROLE_CONFIG[member.role] || ROLE_CONFIG.viewer;
            const saving = savingUserId === member.user_id;

            return (
              <label
                key={member.id}
                className="flex items-center justify-between gap-4 p-4 cursor-pointer hover:bg-secondary/30"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.user_name || member.user_email}
                  </p>
                  <p className="text-xs text-muted-foreground">{role.label}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  <Switch
                    checked={enabled}
                    disabled={saving}
                    onCheckedChange={(checked) => handleToggle(member, checked)}
                  />
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
