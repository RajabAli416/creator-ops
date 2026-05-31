import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/api/client';
import { supabase } from '@/lib/supabase';

export function useChatMessages(roomId, { membersByUserId = {} } = {}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const knownIds = useRef(new Set());

  const enrichMessage = useCallback(
    (row) => {
      const member = membersByUserId[row.sender_id];
      return {
        id: row.id,
        room_id: row.room_id,
        organization_id: row.team_id,
        sender_id: row.sender_id,
        sender_name: member?.user_name || row.sender_name || '',
        sender_email: member?.user_email || row.sender_email || '',
        body: row.body,
        created_date: row.created_at || row.created_date,
      };
    },
    [membersByUserId]
  );

  useEffect(() => {
    if (!roomId) {
      setMessages([]);
      knownIds.current = new Set();
      return undefined;
    }

    let cancelled = false;
    knownIds.current = new Set();
    setLoading(true);

    api.entities.ChatMessage.list(roomId)
      .then((rows) => {
        if (cancelled) return;
        knownIds.current = new Set(rows.map((r) => r.id));
        setMessages(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const unsubscribe = api.chat.subscribeToChatRoom(roomId, async (row) => {
      if (knownIds.current.has(row.id)) return;
      knownIds.current.add(row.id);

      let enriched = enrichMessage(row);
      if (!enriched.sender_name) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', row.sender_id)
          .maybeSingle();
        enriched = {
          ...enriched,
          sender_name: profile?.full_name || profile?.email || '',
          sender_email: profile?.email || '',
        };
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === enriched.id)) return prev;
        return [...prev, enriched];
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [roomId, enrichMessage]);

  const sendMessage = async (body) => {
    const created = await api.entities.ChatMessage.create({
      room_id: roomId,
      organization_id: messages[0]?.organization_id,
      body,
    });
    knownIds.current.add(created.id);
    setMessages((prev) => {
      if (prev.some((m) => m.id === created.id)) return prev;
      return [...prev, created];
    });
    return created;
  };

  const sendMessageToOrg = async (organizationId, body) => {
    const created = await api.entities.ChatMessage.create({
      room_id: roomId,
      organization_id: organizationId,
      body,
    });
    knownIds.current.add(created.id);
    setMessages((prev) => {
      if (prev.some((m) => m.id === created.id)) return prev;
      return [...prev, created];
    });
    return created;
  };

  return { messages, loading, sendMessage, sendMessageToOrg, setMessages };
}
