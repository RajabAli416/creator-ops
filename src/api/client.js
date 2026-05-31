import { supabaseAuth } from '@/api/supabase/auth';
import {
  Organization,
  OrganizationMember,
  ContentItem,
  Task,
  ActivityLog,
  joinTeam,
  getPendingTeamInvites,
  acceptTeamInvite,
} from '@/api/supabase/entities';
import { ChatRoom, ChatMessage, ChatPermission, subscribeToChatRoom } from '@/api/supabase/chat';

export const api = {
  auth: supabaseAuth,

  entities: {
    Organization,
    OrganizationMember,
    ContentItem,
    Task,
    ActivityLog,
    ChatRoom,
    ChatMessage,
    ChatPermission,
  },

  chat: {
    subscribeToChatRoom,
  },

  workspace: {
    joinTeam,
    getPendingTeamInvites,
    acceptTeamInvite,
  },
};
