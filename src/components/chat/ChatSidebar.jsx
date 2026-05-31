import React from 'react';
import { Hash, MessageCircle, Users } from 'lucide-react';
import { getDirectThreadTitle, isPrivilegedChatRole } from '@/lib/chatDisplay';

export default function ChatSidebar({
  generalRoom,
  directRooms,
  members,
  membersByUserId,
  selectedKey,
  onSelectGeneral,
  onSelectDirect,
  onStartDirect,
  viewerId,
  viewerRole,
  canManageChat,
}) {
  const dmTargets = canManageChat
    ? members.filter((m) => m.user_id !== viewerId)
    : [];

  return (
    <div className="w-full lg:w-72 border-r border-border flex flex-col bg-card/30 shrink-0">
      <div className="p-3 border-b border-border">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Conversations
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
            Workspace
          </p>
          <button
            type="button"
            onClick={onSelectGeneral}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedKey === 'general'
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <Hash className="w-4 h-4 shrink-0" />
            <span className="truncate">General</span>
          </button>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
            Direct messages
          </p>

          {directRooms.length === 0 && !canManageChat && (
            <p className="text-xs text-muted-foreground px-3 py-2">
              Leadership can message you here.
            </p>
          )}

          <div className="space-y-0.5">
            {directRooms.map((room) => {
              const title = getDirectThreadTitle({
                viewerId,
                viewerRole,
                participants: room.participants,
                membersByUserId,
              });
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => onSelectDirect(room)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedKey === room.id
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">{title}</span>
                </button>
              );
            })}
          </div>

          {canManageChat && dmTargets.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/60">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1">
                <Users className="w-3 h-3" />
                Message a member
              </p>
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {dmTargets.map((member) => (
                  <button
                    key={member.user_id}
                    type="button"
                    onClick={() => onStartDirect(member)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-left"
                  >
                    <span className="truncate">{member.user_name || member.user_email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {!isPrivilegedChatRole(viewerRole) && (
        <div className="p-3 border-t border-border text-[10px] text-muted-foreground leading-relaxed">
          In general chat, other members are anonymous. Owners and managers always see real names.
        </div>
      )}
    </div>
  );
}
