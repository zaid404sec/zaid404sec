-- WashDesk realtime cloud sync schema for Supabase
-- Run this once in Supabase Dashboard → SQL Editor for your project.

create table if not exists public.washdesk_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.washdesk_sync enable row level security;

-- Supabase Data API grants: access is still restricted by the RLS policies below.
grant select, insert, update on public.washdesk_sync to authenticated;

drop policy if exists "WashDesk users can read own data" on public.washdesk_sync;
create policy "WashDesk users can read own data"
  on public.washdesk_sync for select
  using (auth.uid() = user_id);

drop policy if exists "WashDesk users can insert own data" on public.washdesk_sync;
create policy "WashDesk users can insert own data"
  on public.washdesk_sync for insert
  with check (auth.uid() = user_id);

drop policy if exists "WashDesk users can update own data" on public.washdesk_sync;
create policy "WashDesk users can update own data"
  on public.washdesk_sync for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Atomically allocate a daily invoice sequence shared by every connected device.
create table if not exists public.washdesk_invoice_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_date date not null,
  next_value integer not null default 1,
  primary key (user_id, invoice_date)
);

alter table public.washdesk_invoice_counters enable row level security;

create or replace function public.washdesk_next_invoice_number(
  p_prefix text default 'CW',
  p_date date default current_date,
  p_min_next_value integer default 1
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_seq integer;
  v_prefix text;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;
  v_prefix := upper(left(regexp_replace(coalesce(p_prefix, 'CW'), '[^A-Za-z0-9-]', '', 'g'), 4));
  if v_prefix = '' then v_prefix := 'CW'; end if;
  insert into public.washdesk_invoice_counters(user_id, invoice_date, next_value)
    values (v_user, p_date, greatest(1, coalesce(p_min_next_value, 1)))
  on conflict (user_id, invoice_date) do update
    set next_value = greatest(public.washdesk_invoice_counters.next_value + 1, excluded.next_value)
  returning next_value into v_seq;
  return v_prefix || '-' || to_char(p_date, 'YYMMDD') || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

revoke all on function public.washdesk_next_invoice_number(text, date, integer) from public;
grant execute on function public.washdesk_next_invoice_number(text, date, integer) to authenticated;

-- Allow signed-in devices to receive cross-device updates in realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'washdesk_sync'
  ) then
    alter publication supabase_realtime add table public.washdesk_sync;
  end if;
end $$;
