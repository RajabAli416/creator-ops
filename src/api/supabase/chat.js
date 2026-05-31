import { supabase } from '@/lib/supabase';
import { supabaseAuth } from '@/api/supabase/auth';
import { mapChatMessageRow, mapChatRoomRow, mapChatPermissionRow } from '@/api/mappers';

async function requireUser() {
  return supabaseAuth.me();
}

async function attachParticipants(rooms) {
  if (!rooms.length) return [];

  const roomIds = rooms.map((r) => r.id);
  const { data: participants, error } = await supabase
    .from('chat_room_participants')
    .select('room_id, user_id, created_at')
    .in('room_id', roomIds);

  if (error) throw error;

  const byRoom = {};
  for (const p of participants || []) {
    if (!byRoom[p.room_id]) byRoom[p.room_id] = [];
    byRoom[p.room_id].push(p);
  }

  return rooms.map((room) =>
    mapChatRoomRow({ ...room, participants: byRoom[room.id] || [] })
  );
}

async function attachSenderProfiles(messages) {
  if (!messages.length) return [];

  const senderIds = [...new Set(messages.map((m) => m.sender_id).filter(Boolean))];
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url')
    .in('id', senderIds);

  if (error) throw error;

  const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  return messages.map((row) =>
    mapChatMessageRow({ ...row, profiles: profileById[row.sender_id] || null })
  );
}

export const ChatRoom = {
  async ensureGeneral(organizationId) {
    const { data: existing, error: selectError } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('team_id', organizationId)
      .eq('type', 'general')
      .maybeSingle();

    if (selectError) throw selectError;
    if (existing) return mapChatRoomRow({ ...existing, participants: [] });

    const { data: created, error: insertError } = await supabase
      .from('chat_rooms')
      .insert({ team_id: organizationId, type: 'general' })
      .select('*')
      .single();

    if (insertError) throw insertError;
    return mapChatRoomRow({ ...created, participants: [] });
  },

  async listDirect(organizationId) {
    const user = await requireUser();

    const { data: rooms, error } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('team_id', organizationId)
      .eq('type', 'direct')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!rooms?.length) return [];

    const withParticipants = await attachParticipants(rooms);

    return withParticipants.filter((room) =>
      room.participants.some((p) => p.user_id === user.id)
    );
  },

  async getOrCreateDirect(organizationId, targetUserId) {
    const user = await requireUser();

    const { data: allRooms, error } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('team_id', organizationId)
      .eq('type', 'direct')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const withParticipants = await attachParticipants(allRooms || []);
    const existingRooms = withParticipants.filter((room) =>
      room.participants.some((p) => p.user_id === user.id)
    );

    const match = existingRooms.find((room) => {
      const ids = room.participants.map((p) => p.user_id).sort();
      return ids.length === 2 && ids.includes(user.id) && ids.includes(targetUserId);
    });
    if (match) return match;

    if (targetUserId === user.id) {
      throw new Error('You cannot start a direct chat with yourself');
    }

    const { data: room, error: roomError } = await supabase
      .from('chat_rooms')
      .insert({
        team_id: organizationId,
        type: 'direct',
        created_by: user.id,
      })
      .select('*')
      .single();

    if (roomError) throw roomError;

    const { error: participantsError } = await supabase.from('chat_room_participants').insert([
      { room_id: room.id, user_id: user.id },
      { room_id: room.id, user_id: targetUserId },
    ]);

    if (participantsError) throw participantsError;

    const [mapped] = await attachParticipants([room]);
    return mapped;
  },
};

export const ChatMessage = {
  async list(roomId, { limit = 80, before } = {}) {
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;

    const mapped = await attachSenderProfiles(data || []);
    return mapped.reverse();
  },

  async create({ room_id, organization_id, body }) {
    const user = await requireUser();
    const trimmed = body?.trim();
    if (!trimmed) throw new Error('Message cannot be empty');

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        room_id,
        team_id: organization_id,
        sender_id: user.id,
        body: trimmed,
      })
      .select('*')
      .single();

    if (error) throw error;

    const [mapped] = await attachSenderProfiles([data]);
    return mapped;
  },
};

export const ChatPermission = {
  async list(organizationId) {
    const { data, error } = await supabase
      .from('team_member_chat_permissions')
      .select('*')
      .eq('team_id', organizationId);

    if (error) throw error;
    return (data || []).map(mapChatPermissionRow);
  },

  async getForUser(organizationId, userId) {
    const { data, error } = await supabase
      .from('team_member_chat_permissions')
      .select('*')
      .eq('team_id', organizationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { organization_id: organizationId, user_id: userId, general_chat_enabled: true };
    return mapChatPermissionRow(data);
  },

  async setGeneralChatEnabled(organizationId, userId, enabled) {
    const { data, error } = await supabase
      .from('team_member_chat_permissions')
      .upsert(
        {
          team_id: organizationId,
          user_id: userId,
          general_chat_enabled: enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'team_id,user_id' }
      )
      .select('*')
      .single();

    if (error) throw error;
    return mapChatPermissionRow(data);
  },
};

export function subscribeToChatRoom(roomId, onInsert) {
  const channel = supabase
    .channel(`chat-messages:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        onInsert?.(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
