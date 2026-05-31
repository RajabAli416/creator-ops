import React, { useEffect, useRef } from 'react';
import { Loader2, MessageSquare, Lock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatMessageBubble from './ChatMessageBubble';
import ChatComposer from './ChatComposer';
import { useChatMessages } from '@/hooks/useChatMessages';
import { isPrivilegedChatRole } from '@/lib/chatDisplay';

export default function ChatThread({
  room,
  organizationId,
  viewerId,
  viewerRole,
  membersByUserId,
  canSend,
  disabledReason,
}) {
  const bottomRef = useRef(null);
  const isDirect = room?.type === 'direct';

  const { messages, loading, sendMessageToOrg } = useChatMessages(room?.id, {
    membersByUserId,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, room?.id]);

  const getSenderRole = (senderId) => membersByUserId[senderId]?.role || 'viewer';

  const handleSend = (body) =>
    sendMessageToOrg(organizationId, body);

  if (!room) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select a conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <ScrollArea className="flex-1 px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No messages yet. Say hello!</p>
            {!isDirect && !isPrivilegedChatRole(viewerRole) && (
              <p className="text-xs mt-2 max-w-xs mx-auto">
                Other members appear as &quot;Team member&quot; — only owners and managers see names.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessageBubble
                key={message.id}
                message={message}
                viewerId={viewerId}
                viewerRole={viewerRole}
                senderRole={getSenderRole(message.sender_id)}
                isDirect={isDirect}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {canSend ? (
        <ChatComposer onSend={handleSend} />
      ) : (
        <div className="border-t border-border p-4 bg-secondary/30 flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="w-4 h-4 shrink-0" />
          {disabledReason || 'You cannot send messages in this chat.'}
        </div>
      )}
    </div>
  );
}
