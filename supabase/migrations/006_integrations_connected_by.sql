-- Legacy integrations tables may require connected_by as a real column (NOT NULL).
-- The app now sets connected_by to the connecting user's auth id on OAuth save.
-- This migration relaxes NOT NULL so older rows / token refresh updates still work.

alter table public.integrations alter column connected_by drop not null;

-- If connected_by was uuid and metadata has email, leave as-is; app uses user.id on new connects.
