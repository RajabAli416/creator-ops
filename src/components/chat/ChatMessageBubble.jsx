import React from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { getMessageSenderDisplay } from '@/lib/chatDisplay';
import { ROLE_CONFIG } from '@/lib/workspace.jsx';

function formatMessageTime(dateStr) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`;
  return format(date, 'MMM d, h:mm a');
}

export default function ChatMessageBubble({
  message,
  viewerId,
  viewerRole,
  senderRole,
  isDirect,
}) {
  const display = getMessageSenderDisplay({
    viewerId,
    viewerRole,
    senderId: message.sender_id,
    senderName: message.sender_name,
    senderRole,
    isDirect,
  });

  const roleLabel = display.sublabel
    ? ROLE_CONFIG[display.sublabel]?.label || display.sublabel
    : null;

  const initials = display.anonymous
    ? '?'
    : (display.label === 'You'
        ? 'Y'
        : display.label
            .split(' ')
            .map((p) => p[0])
            .join('')
            .slice(0, 2)
            .toUpperCase());

  return (
    <div className="flex gap-2.5 px-1">
      <div
        className={`w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-semibold shrink-0 ${display.accent}`}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{display.label}</span>
          {roleLabel && !display.anonymous && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {roleLabel}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {formatMessageTime(message.created_date)}
          </span>
        </div>
        <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap break-words">
          {message.body}
        </p>
      </div>
    </div>
  );
}
