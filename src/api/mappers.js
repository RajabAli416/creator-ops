const PIPELINE_PUBLISHED = 'published';
const PIPELINE_SCHEDULED = 'scheduled';

/** UI role (manager, writer) ↔ DB role (admin, editor) */
export function roleToDb(uiRole) {
  if (uiRole === 'manager') return 'admin';
  if (uiRole === 'writer') return 'editor';
  return uiRole;
}

export function roleFromDb(dbRole) {
  if (dbRole === 'admin') return 'manager';
  return dbRole;
}

export function pipelineStageToDbStatus(stage) {
  if (stage === PIPELINE_PUBLISHED) return 'published';
  if (stage === PIPELINE_SCHEDULED) return 'scheduled';
  if (stage === 'archived') return 'archived';
  return 'draft';
}

export function dbStatusToPipelineStage(status, metaStage) {
  if (metaStage) return metaStage;
  if (status === 'published') return PIPELINE_PUBLISHED;
  if (status === 'scheduled') return PIPELINE_SCHEDULED;
  return 'idea';
}

export function packContentDescription({ description, status, priority, due_date, assigned_members, labels, sort_order }) {
  const text = (description || '').trim();
  const hasMeta =
    status ||
    priority ||
    due_date ||
    assigned_members?.length ||
    labels?.length ||
    sort_order != null;

  if (!hasMeta) return text || null;

  return JSON.stringify({
    _meta: {
      pipeline_stage: status || 'idea',
      priority: priority || 'medium',
      due_date: due_date || null,
      assigned_members: assigned_members || [],
      labels: labels || [],
      sort_order: sort_order ?? 0,
    },
    text,
  });
}

export function unpackContentDescription(raw) {
  if (!raw) {
    return { text: '', meta: { pipeline_stage: 'idea', priority: 'medium', assigned_members: [], labels: [], sort_order: 0 } };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed._meta) {
      return {
        text: parsed.text || '',
        meta: {
          pipeline_stage: parsed._meta.pipeline_stage || 'idea',
          priority: parsed._meta.priority || 'medium',
          due_date: parsed._meta.due_date || null,
          assigned_members: parsed._meta.assigned_members || [],
          labels: parsed._meta.labels || [],
          sort_order: parsed._meta.sort_order ?? 0,
        },
      };
    }
  } catch {
    /* plain text description */
  }
  return { text: raw, meta: { pipeline_stage: 'idea', priority: 'medium', assigned_members: [], labels: [], sort_order: 0 } };
}

export function mapTeamToOrg(team, creatorEmail = null) {
  return {
    id: team.id,
    name: team.name,
    slug: team.slug,
    description: team.description || '',
    logo_url: team.logo_url || '',
    created_by: creatorEmail || team.created_by,
    created_date: team.created_at,
    updated_date: team.updated_at,
    invite_code: team.slug,
  };
}

export function mapMemberRow(row) {
  const profile = row.profiles || row.profile;
  return {
    id: row.id,
    organization_id: row.team_id,
    user_id: row.user_id,
    user_email: profile?.email || row.user_email || '',
    user_name: profile?.full_name || profile?.email || row.user_email || '',
    role: roleFromDb(row.role),
    status: row.status || 'active',
    joined_at: row.joined_at,
  };
}

export function mapContentRow(row) {
  const { text, meta } = unpackContentDescription(row.description);
  return {
    id: row.id,
    organization_id: row.team_id,
    title: row.title,
    description: text,
    status: dbStatusToPipelineStage(row.status, meta.pipeline_stage),
    priority: meta.priority,
    due_date: meta.due_date,
    assigned_members: meta.assigned_members,
    labels: meta.labels,
    sort_order: meta.sort_order,
    type: row.type,
    content_url: row.content_url,
    platform: row.platform,
    thumbnail_url: row.thumbnail_url,
    created_date: row.created_at,
    updated_date: row.updated_at,
    created_by: row.created_by,
  };
}

export function mapTaskRow(row) {
  return {
    id: row.id,
    organization_id: row.team_id,
    content_item_id: row.content_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    due_date: row.due_date,
    assigned_to: row.assigned_to,
    created_date: row.created_at,
    updated_date: row.updated_at,
    created_by: row.created_by,
  };
}

export function mapAuditRow(row) {
  const changes = row.changes || {};
  return {
    id: row.id,
    organization_id: row.team_id,
    content_item_id: changes.content_item_id || (row.entity_type === 'content' ? row.entity_id : ''),
    task_id: changes.task_id || (row.entity_type === 'task' ? row.entity_id : ''),
    actor_email: changes.actor_email || '',
    actor_name: changes.actor_name || changes.actor_email || '',
    action: row.action,
    entity_type: row.entity_type,
    details: changes.details || '',
    created_date: row.created_at,
  };
}

export function mapUser(sessionUser, profile) {
  return {
    id: sessionUser.id,
    email: sessionUser.email || profile?.email,
    full_name: profile?.full_name || sessionUser.user_metadata?.full_name || '',
    avatar_url: profile?.avatar_url,
  };
}
