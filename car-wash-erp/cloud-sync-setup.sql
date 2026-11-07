-- Prime Auto Care shared cloud sync for Supabase.
-- Run this entire script once in Supabase Dashboard → SQL Editor.
-- All five devices must sign in with the same shared business email account.

create table if not exists public.washdesk_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.washdesk_sync enable row level security;

drop policy if exists "WashDesk users can read own data" on public.washdesk_sync;
drop policy if exists "Prime Auto Care users can read own data" on public.washdesk_sync;
create policy "Prime Auto Care users can read own data"
  on public.washdesk_sync for select
  using (auth.uid() = user_id);

-- Clients can read only their row. Writes go through the SECURITY DEFINER
-- merge RPC, which locks the row and merges records before committing.
revoke all on public.washdesk_sync from anon, authenticated;
grant select on public.washdesk_sync to authenticated;

create or replace function public.washdesk_safe_number(p_value text)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_value is not null and p_value ~ '^-?[0-9]+(\\.[0-9]+)?$' then
    return p_value::numeric;
  end if;
  return 0;
end;
$$;

create or replace function public.washdesk_record_stamp(p_record jsonb)
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select greatest(
    public.washdesk_safe_number(p_record->>'updatedAt'),
    public.washdesk_safe_number(p_record->>'editedAt'),
    public.washdesk_safe_number(p_record->>'createdAt')
  );
$$;

create or replace function public.washdesk_merge_sync(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_existing jsonb := '{}'::jsonb;
  v_merged jsonb;
  v_deleted jsonb := '{}'::jsonb;
  v_records jsonb;
  v_collection text;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'A valid business data object is required';
  end if;
  if octet_length(p_payload::text) > 8000000 then
    raise exception 'Business data exceeds the 8 MB sync limit. Export a backup and contact support.';
  end if;

  -- Ensure the row exists, then serialize all writers for this business account.
  insert into public.washdesk_sync(user_id, payload)
    values (v_user, '{}'::jsonb)
    on conflict (user_id) do nothing;

  select payload into v_existing
    from public.washdesk_sync
    where user_id = v_user
    for update;

  -- Merge deletion markers by retaining the greatest deletion timestamp.
  select coalesce(jsonb_object_agg(key, to_jsonb(max_stamp)), '{}'::jsonb)
    into v_deleted
    from (
      select key, max(public.washdesk_safe_number(value)) as max_stamp
        from (
          select key, value from jsonb_each_text(coalesce(v_existing->'_deletedIds', '{}'::jsonb))
          union all
          select key, value from jsonb_each_text(coalesce(p_payload->'_deletedIds', '{}'::jsonb))
        ) markers
        group by key
    ) merged_markers;

  v_merged := v_existing || p_payload;
  v_merged := jsonb_set(v_merged, '{_deletedIds}', v_deleted, true);

  foreach v_collection in array array[
    'customers','vehicles','services','invoices','products',
    'purchases','expenses','staff','payments'
  ] loop
    execute format(
      'select coalesce(jsonb_agg(record order by record->>''id''), ''[]''::jsonb)
         from (
           select distinct on (record->>''id'') record
             from (
               select value as record
                 from jsonb_array_elements(
                   coalesce($1->%L, ''[]''::jsonb) || coalesce($2->%L, ''[]''::jsonb)
                 )
             ) candidates
            where nullif(record->>''id'', '''') is not null
            order by record->>''id'',
                     public.washdesk_record_stamp(record) desc,
                     record::text desc
         ) chosen
        where public.washdesk_safe_number($3->>(record->>''id'')) < public.washdesk_record_stamp(record)',
      v_collection, v_collection
    ) into v_records using v_existing, p_payload, v_deleted;

    v_merged := jsonb_set(v_merged, array[v_collection], coalesce(v_records, '[]'::jsonb), true);
  end loop;

  -- Business profile and preferences use their own update timestamps.
  if public.washdesk_record_stamp(coalesce(v_existing->'business','{}'::jsonb))
     > public.washdesk_record_stamp(coalesce(p_payload->'business','{}'::jsonb)) then
    v_merged := jsonb_set(v_merged, '{business}', coalesce(v_existing->'business','{}'::jsonb), true);
  end if;
  if public.washdesk_record_stamp(coalesce(v_existing->'settings','{}'::jsonb))
     > public.washdesk_record_stamp(coalesce(p_payload->'settings','{}'::jsonb)) then
    v_merged := jsonb_set(v_merged, '{settings}', coalesce(v_existing->'settings','{}'::jsonb), true);
  end if;
  v_merged := jsonb_set(
    v_merged, '{meta}',
    coalesce(v_existing->'meta','{}'::jsonb) || coalesce(p_payload->'meta','{}'::jsonb), true
  );

  update public.washdesk_sync
     set payload = v_merged, updated_at = now()
   where user_id = v_user;

  return v_merged;
end;
$$;

revoke all on function public.washdesk_safe_number(text) from public;
revoke all on function public.washdesk_record_stamp(jsonb) from public;
revoke all on function public.washdesk_merge_sync(jsonb) from public;
grant execute on function public.washdesk_merge_sync(jsonb) to authenticated;

-- Atomically allocate a daily invoice sequence shared by every signed-in device.
create table if not exists public.washdesk_invoice_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_date date not null,
  next_value integer not null default 1,
  primary key (user_id, invoice_date)
);

alter table public.washdesk_invoice_counters enable row level security;
revoke all on public.washdesk_invoice_counters from anon, authenticated;

create or replace function public.washdesk_next_invoice_number(
  p_prefix text default 'CW',
  p_date date default current_date,
  p_min_next_value integer default 1
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
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

-- Realtime publication lets all authenticated devices receive committed changes.
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
