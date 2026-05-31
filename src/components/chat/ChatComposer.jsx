import React, { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function ChatComposer({ disabled, disabledReason, onSend, placeholder }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled || sending) return;

    setSending(true);
    try {
      await onSend(trimmed);
      setText('');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-border p-3 bg-card/50">
      {disabled && disabledReason && (
        <p className="text-xs text-muted-foreground mb-2 px-1">{disabledReason}</p>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Write a message…'}
          disabled={disabled || sending}
          rows={2}
          className="min-h-[44px] max-h-32 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={disabled || sending || !text.trim()}
          className="shrink-0 h-10 w-10"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
}
