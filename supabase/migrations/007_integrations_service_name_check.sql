-- Legacy integrations tables often restrict service_name to a fixed list that
-- does not include 'google'. Creator Ops uses service_name = 'google' for
-- YouTube + Drive workspace OAuth.

alter table public.integrations drop constraint if exists integrations_service_name_check;
