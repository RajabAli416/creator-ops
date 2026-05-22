import { api } from '@/api/client';

export async function logActivity({ organizationId, contentItemId, taskId, action, entityType, details }) {
  const user = await api.auth.me();
  await api.entities.ActivityLog.create({
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