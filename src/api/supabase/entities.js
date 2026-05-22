import { supabase } from '@/lib/supabase';
import { supabaseAuth } from '@/api/supabase/auth';
import {
  mapTeamToOrg,
  mapMemberRow,
  mapContentRow,
  mapTaskRow,
  mapAuditRow,
  roleToDb,
  packContentDescription,
  unpackContentDescription,
  pipelineStageToDbStatus,
} from '@/api/mappers';

async function requireUser() {
  return supabaseAuth.me();
}

async function getProfileByEmail(email) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** team_members.user_id → auth.users, not profiles — fetch profiles separately */
async function mapMembersWithProfiles(rows) {
  if (!rows?.length) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url')
    .in('id', userIds);

  if (error) throw error;

  const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  return rows.map((row) =>
    mapMemberRow({ ...row, profiles: profileById[row.user_id] || null })
  );
}

function applySort(query, sortField) {
  if (!sortField) return query;
  const desc = sortField.startsWith('-');
  const field = desc ? sortField.slice(1) : sortField;
  const column = field === 'created_date' ? 'created_at' : field;
  return query.order(column, { ascending: !desc });
}

export const Organization = {
  async list() {
    const user = await requireUser();
    const { data: memberships, error } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id);

    if (error) throw error;
    if (!memberships?.length) return [];

    const teamIds = memberships.map((m) => m.team_id);
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .in('id', teamIds);

    if (teamsError) throw teamsError;
    return (teams || []).map((team) => mapTeamToOrg(team, user.email));
  },

  async filter() {
    return this.list();
  },

  async create(data) {
    const user = await requireUser();
    const slug =
      data.slug ||
      data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { data: team, error } = await supabase
      .from('teams')
      .insert({
        name: data.name,
        slug,
        description: data.description || null,
        logo_url: data.logo_url || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    const { error: memberError } = await supabase.from('team_members').insert({
      team_id: team.id,
      user_id: user.id,
      role: 'owner',
    });
    if (memberError) throw memberError;

    return mapTeamToOrg(team, user.email);
  },

  async update(id, data) {
    const payload = {};
    if (data.name != null) payload.name = data.name;
    if (data.description != null) payload.description = data.description;
    if (data.logo_url != null) payload.logo_url = data.logo_url;
    payload.updated_at = new Date().toISOString();

    const { data: team, error } = await supabase
      .from('teams')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapTeamToOrg(team);
  },

  async delete(id) {
    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (error) throw error;
  },
};

export const OrganizationMember = {
  async filter(filter = {}) {
    let userId = filter.user_id;

    if (filter.user_email && !userId) {
      const user = await requireUser();
      if (filter.user_email.trim().toLowerCase() === user.email?.trim().toLowerCase()) {
        userId = user.id;
      } else {
        const profile = await getProfileByEmail(filter.user_email);
        if (!profile) return [];
        userId = profile.id;
      }
    }

    if (userId) {
      let query = supabase.from('team_members').select('*').eq('user_id', userId);

      if (filter.organization_id) {
        query = query.eq('team_id', filter.organization_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (filter.status === 'invited') {
        return [];
      }
      return mapMembersWithProfiles(data || []);
    }

    if (filter.organization_id) {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', filter.organization_id);

      if (error) throw error;
      return mapMembersWithProfiles(data || []);
    }

    return [];
  },

  async create(data) {
    const user = await requireUser();
    let userId = data.user_id;

    if (data.user_email && !userId) {
      const profile = await getProfileByEmail(data.user_email);
      if (!profile) {
        throw new Error(
          `${data.user_email} does not have an account yet. They need to sign up first.`
        );
      }
      userId = profile.id;
    }

    const { data: row, error } = await supabase
      .from('team_members')
      .insert({
        team_id: data.organization_id,
        user_id: userId,
        role: roleToDb(data.role || 'editor'),
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('This user is already a member of this workspace');
      }
      throw error;
    }

    if (userId !== user.id) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'team_invite',
        message: JSON.stringify({
          team_id: data.organization_id,
          role: data.role || 'editor',
        }),
      });
    }

    const [member] = await mapMembersWithProfiles([row]);
    return member;
  },

  async update(id, data) {
    const payload = {};
    if (data.role != null) payload.role = roleToDb(data.role);

    const { data: row, error } = await supabase
      .from('team_members')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    const [member] = await mapMembersWithProfiles([row]);
    return member;
  },

  async delete(id) {
    const { error } = await supabase.from('team_members').delete().eq('id', id);
    if (error) throw error;
  },
};

export const ContentItem = {
  async filter(filter = {}, sortField, limit) {
    let query = supabase.from('content_items').select('*');

    if (filter.organization_id) {
      query = query.eq('team_id', filter.organization_id);
    }

    query = applySort(query, sortField || '-created_at');
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapContentRow);
  },

  async create(data) {
    const user = await requireUser();
    const pipelineStage = data.status || 'idea';

    const { data: row, error } = await supabase
      .from('content_items')
      .insert({
        team_id: data.organization_id,
        title: data.title,
        description: packContentDescription(data),
        type: data.type || 'video',
        status: pipelineStageToDbStatus(pipelineStage),
        thumbnail_url: data.thumbnail_url || null,
        platform: data.platform || null,
        platform_id: data.platform_id || null,
        content_url: data.content_url || null,
        scheduled_for: data.due_date ? new Date(data.due_date).toISOString() : null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return mapContentRow(row);
  },

  async update(id, data) {
    const { data: existing, error: fetchError } = await supabase
      .from('content_items')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    const payload = { updated_at: new Date().toISOString() };

    if (data.title != null) payload.title = data.title;
    if (data.thumbnail_url != null) payload.thumbnail_url = data.thumbnail_url;
    if (data.content_url != null) payload.content_url = data.content_url;

    if (
      data.description != null ||
      data.status != null ||
      data.priority != null ||
      data.due_date != null ||
      data.assigned_members != null ||
      data.labels != null ||
      data.sort_order != null
    ) {
      const { text, meta } = unpackContentDescription(existing.description);
      const merged = {
        description: data.description ?? text,
        status: data.status ?? meta.pipeline_stage,
        priority: data.priority ?? meta.priority,
        due_date: data.due_date ?? meta.due_date,
        assigned_members: data.assigned_members ?? meta.assigned_members,
        labels: data.labels ?? meta.labels,
        sort_order: data.sort_order ?? meta.sort_order,
      };
      payload.description = packContentDescription(merged);
      if (data.status != null) {
        payload.status = pipelineStageToDbStatus(data.status);
        if (data.status === 'scheduled' && data.due_date) {
          payload.scheduled_for = new Date(data.due_date).toISOString();
        }
        if (data.status === 'published') {
          payload.published_at = new Date().toISOString();
        }
      }
    }

    const { data: row, error } = await supabase
      .from('content_items')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapContentRow(row);
  },

  async delete(id) {
    const { error } = await supabase.from('content_items').delete().eq('id', id);
    if (error) throw error;
  },
};

export const Task = {
  async filter(filter = {}, sortField, limit) {
    let query = supabase.from('tasks').select('*');

    if (filter.organization_id) query = query.eq('team_id', filter.organization_id);
    if (filter.content_item_id) query = query.eq('content_id', filter.content_item_id);

    query = applySort(query, sortField || '-created_at');
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapTaskRow);
  },

  async create(data) {
    const user = await requireUser();
    const { data: row, error } = await supabase
      .from('tasks')
      .insert({
        team_id: data.organization_id,
        content_id: data.content_item_id || null,
        title: data.title,
        description: data.description || null,
        status: data.status || 'todo',
        priority: data.priority || 'medium',
        due_date: data.due_date ? new Date(data.due_date).toISOString() : null,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) throw error;
    return mapTaskRow(row);
  },

  async update(id, data) {
    const payload = { updated_at: new Date().toISOString() };
    if (data.title != null) payload.title = data.title;
    if (data.description != null) payload.description = data.description;
    if (data.status != null) payload.status = data.status;
    if (data.priority != null) payload.priority = data.priority;
    if (data.due_date != null) payload.due_date = data.due_date ? new Date(data.due_date).toISOString() : null;

    const { data: row, error } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapTaskRow(row);
  },

  async delete(id) {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
  },
};

export const ActivityLog = {
  async filter(filter = {}, sortField, limit) {
    let query = supabase.from('audit_logs').select('*');

    if (filter.organization_id) query = query.eq('team_id', filter.organization_id);

    if (filter.content_item_id) {
      query = query.eq('changes->>content_item_id', filter.content_item_id);
    }

    query = applySort(query, sortField || '-created_at');
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapAuditRow);
  },

  async create(data) {
    const user = await requireUser();
    const entityId = data.content_item_id || data.task_id || null;

    const { data: row, error } = await supabase
      .from('audit_logs')
      .insert({
        team_id: data.organization_id,
        user_id: user.id,
        action: data.action,
        entity_type: data.entity_type,
        entity_id: entityId || null,
        changes: {
          details: data.details,
          actor_email: data.actor_email || user.email,
          actor_name: data.actor_name || user.full_name || user.email,
          content_item_id: data.content_item_id || null,
          task_id: data.task_id || null,
        },
      })
      .select()
      .single();
    if (error) throw error;
    return mapAuditRow(row);
  },

  async delete(id) {
    const { error } = await supabase.from('audit_logs').delete().eq('id', id);
    if (error) throw error;
  },
};

/** Join workspace + pending invites (notifications) */
export async function joinTeam({ slug, organizationId }) {
  const user = await requireUser();
  let team = null;

  if (organizationId) {
    const { data, error } = await supabase.from('teams').select('*').eq('id', organizationId).single();
    if (error) throw error;
    team = data;
  } else if (slug) {
    const normalizedSlug = slug.trim().toLowerCase();
    const { data, error } = await supabase.from('teams').select('*').eq('slug', normalizedSlug).maybeSingle();
    if (error) throw error;
    team = data;
  }

  if (!team) throw new Error('Workspace not found. Check the slug and try again.');

  const { data: existing } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', team.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from('team_members').insert({
      team_id: team.id,
      user_id: user.id,
      role: 'viewer',
    });
    if (error) throw error;
  }

  return mapTeamToOrg(team, user.email);
}

export async function getPendingTeamInvites() {
  const user = await requireUser();
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('type', 'team_invite')
    .eq('read', false);

  if (error) throw error;
  if (!notifications?.length) return [];

  const results = [];
  for (const n of notifications) {
    try {
      const payload = JSON.parse(n.message);
      const { data: team } = await supabase.from('teams').select('*').eq('id', payload.team_id).single();
      if (!team) continue;

      const { data: existing } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', team.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        await supabase.from('notifications').update({ read: true }).eq('id', n.id);
        continue;
      }

      results.push({
        notificationId: n.id,
        invite: {
          id: n.id,
          organization_id: team.id,
          role: payload.role || 'editor',
          status: 'invited',
        },
        org: mapTeamToOrg(team),
      });
    } catch {
      /* skip malformed */
    }
  }
  return results;
}

export async function acceptTeamInvite(notificationId, organizationId) {
  const user = await requireUser();
  const { data: notification } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', notificationId)
    .eq('user_id', user.id)
    .single();

  let role = 'editor';
  if (notification?.message) {
    try {
      role = JSON.parse(notification.message).role || 'editor';
    } catch {
      /* default */
    }
  }

  const { data: existing } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from('team_members').insert({
      team_id: organizationId,
      user_id: user.id,
      role: roleToDb(role),
    });
    if (error) throw error;
  }

  if (notificationId) {
    await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
  }

  const { data: team } = await supabase.from('teams').select('*').eq('id', organizationId).single();
  return mapTeamToOrg(team, user.email);
}
