-- Separate, server-only permission for the paired booking desk to receive booking alerts.
-- This does not change workspace_members.role or the original Workspace Owner.
create table if not exists public.pac_booking_notification_admins (
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null default 'booking_notifications_admin'
    check (permission = 'booking_notifications_admin'),
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (workspace_id, auth_user_id)
);

alter table public.pac_booking_notification_admins enable row level security;
revoke all on public.pac_booking_notification_admins from public, anon, authenticated;
grant all on public.pac_booking_notification_admins to service_role;

comment on table public.pac_booking_notification_admins is
  'Server-only allowlist for reading and acknowledging booking alerts. This permission does not grant Workspace Owner status or access to booking settings.';

insert into public.pac_booking_notification_admins (
  workspace_id, auth_user_id, permission, granted_by
)
select
  a.workspace_id,
  a.auth_user_id,
  'booking_notifications_admin',
  w.owner_auth_user_id
from public.pac_google_review_admins a
join public.washdesk_workspaces w on w.id = a.workspace_id
where lower(w.business_name) = 'prime auto care'
  and a.permission = 'google_reviews_admin'
  and a.revoked_at is null
  and w.owner_auth_user_id is not null
on conflict (workspace_id, auth_user_id) do nothing;
