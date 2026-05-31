import React, { useMemo, useState } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { useWorkspace } from '@/lib/workspace.jsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatThread from '@/components/chat/ChatThread';
import { getDirectThreadTitle, isPrivilegedChatRole } from '@/lib/chatDisplay';
import { Hash, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function Chat() {
  const { user } = useAuth();
  const { currentOrg, currentMember, hasPermission } = useWorkspace();
  const queryClient = useQueryClient();
  const canManageChat = hasPermission(['owner', 'manager']);
  const viewerRole = currentMember?.role || 'viewer';
  const viewerId = user?.id;

  const [selected, setSelected] = useState({ type: 'general', room: null });

  const { data: generalRoom } = useQuery({
    queryKey: ['chat-general', currentOrg?.id],
    queryFn: () => api.entities.ChatRoom.ensureGeneral(currentOrg.id),
    enabled: !!currentOrg,
  });

  const { data: directRooms = [] } = useQuery({
    queryKey: ['chat-direct', currentOrg?.id],
    queryFn: () => api.entities.ChatRoom.listDirect(currentOrg.id),
    enabled: !!currentOrg,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members', currentOrg?.id],
    queryFn: () => api.entities.OrganizationMember.filter({ organization_id: currentOrg.id }),
    enabled: !!currentOrg,
  });

  const { data: myPermission } = useQuery({
    queryKey: ['chat-permission', currentOrg?.id, viewerId],
    queryFn: () => api.entities.ChatPermission.getForUser(currentOrg.id, viewerId),
    enabled: !!currentOrg && !!viewerId && !canManageChat,
  });

  const membersByUserId = useMemo(
    () => Object.fromEntries(members.map((m) => [m.user_id, m])),
    [members]
  );

  const activeRoom = selected.type === 'general' ? generalRoom : selected.room;
  const selectedKey = selected.type === 'general' ? 'general' : selected.room?.id;

  const canSendGeneral =
    canManageChat || (myPermission?.general_chat_enabled ?? true);

  const canSend =
    selected.type === 'general' ? canSendGeneral : !!activeRoom;

  const disabledReason =
    selected.type === 'general' && !canSendGeneral
      ? 'General chat is disabled for your account. Ask an owner or manager.'
      : null;

  const threadTitle =
    selected.type === 'general'
      ? 'General'
      : getDirectThreadTitle({
          viewerId,
          viewerRole,
          participants: activeRoom?.participants || [],
          membersByUserId,
        });

  const handleSelectGeneral = () => {
    setSelected({ type: 'general', room: null });
  };

  const handleSelectDirect = (room) => {
    setSelected({ type: 'direct', room });
  };

  const handleStartDirect = async (member) => {
    if (!currentOrg || !canManageChat) return;
    try {
      const room = await api.entities.ChatRoom.getOrCreateDirect(
        currentOrg.id,
        member.user_id
      );
      queryClient.invalidateQueries({ queryKey: ['chat-direct', currentOrg.id] });
      setSelected({ type: 'direct', room });
    } catch (err) {
      toast.error(err.message || 'Could not open direct chat');
    }
  };

  if (!currentOrg || !viewerId) return null;

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-7rem)] flex flex-col">
      <PageHeader
        title="Chat"
        description="Workspace general chat and direct messages with leadership."
      />

      <div className="flex flex-1 min-h-0 bg-card border border-border rounded-xl overflow-hidden">
        <ChatSidebar
          generalRoom={generalRoom}
          directRooms={directRooms}
          members={members}
          membersByUserId={membersByUserId}
          selectedKey={selectedKey}
          onSelectGeneral={handleSelectGeneral}
          onSelectDirect={handleSelectDirect}
          onStartDirect={handleStartDirect}
          viewerId={viewerId}
          viewerRole={viewerRole}
          canManageChat={canManageChat}
        />

        <div className="flex flex-col flex-1 min-w-0">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0">
            {selected.type === 'general' ? (
              <Hash className="w-4 h-4 text-primary" />
            ) : (
              <MessageCircle className="w-4 h-4 text-primary" />
            )}
            <div>
              <h2 className="text-sm font-semibold">{threadTitle}</h2>
              <p className="text-[10px] text-muted-foreground">
                {selected.type === 'general'
                  ? 'Everyone in the workspace'
                  : 'Private conversation'}
              </p>
            </div>
          </div>

          <ChatThread
            room={activeRoom}
            organizationId={currentOrg.id}
            viewerId={viewerId}
            viewerRole={viewerRole}
            membersByUserId={membersByUserId}
            canSend={canSend && !!activeRoom}
            disabledReason={disabledReason}
          />
        </div>
      </div>
    </div>
  );
}
