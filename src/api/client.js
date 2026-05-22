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

export const api = {
  auth: supabaseAuth,

  entities: {
    Organization,
    OrganizationMember,
    ContentItem,
    Task,
    ActivityLog,
  },

  workspace: {
    joinTeam,
    getPendingTeamInvites,
    acceptTeamInvite,
  },
};
