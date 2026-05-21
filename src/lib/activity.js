import { base44 } from '@/api/base44Client';

export async function logActivity({ organizationId, contentItemId, taskId, action, entityType, details }) {
  const user = await base44.auth.me();
  await base44.entities.ActivityLog.create({
    organization_id: organizationId,
    content_item_id: contentItemId || '',
    task_id: taskId || '',
    actor_email: user.email,
    actor_name: user.full_name || user.email,
    action,
    entity_type: entityType,
    details,
  });
}