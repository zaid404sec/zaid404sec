-- Prime Auto Care shared cloud sync for Supabase.
-- Run this entire script once in Supabase Dashboard -> SQL Editor.
-- Use the same business Gmail account on all four phones and the laptop.

create table if not exists public.washdesk_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.washdesk_sync enable row level security;
alter table public.washdesk_sync replica identity full;

drop policy if exists "WashDesk users can read own data" on public.washdesk_sync;
drop policy if exists "WashDesk users can insert own data" on public.washdesk_sync;
drop policy if exists "WashDesk users can update own data" on public.washdesk_sync;
drop policy if exists "Prime Auto Care users can read own data" on public.washdesk_sync;
create policy "Prime Auto Care users can read own data"
  on public.washdesk_sync for select
  using (auth.uid() = user_id);

revoke all on public.washdesk_sync from anon, authenticated;
grant select on public.washdesk_sync to authenticated;

create or replace function public.washdesk_safe_number(p_value text)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_value is not null and p_value ~ '^-?[0-9]+([.][0-9]+)?$' then
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

-- Select the newest version of each record ID from the local and incoming
-- snapshot. Deletion markers prevent removed records from reappearing.
create or replace function public.washdesk_merge_records(
  p_local jsonb,
  p_remote jsonb,
  p_deleted jsonb
) returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  with candidates as (
    select e.item
    from jsonb_array_elements(
      coalesce(p_local, '[]'::jsonb) || coalesce(p_remote, '[]'::jsonb)
    ) as e(item)
    where nullif(e.item->>'id', '') is not null
  ),
  newest as (
    select distinct on (item->>'id') item
    from candidates
    order by item->>'id',
             public.washdesk_record_stamp(item) desc,
             item::text desc
  )
  select coalesce(jsonb_agg(item order by item->>'id'), '[]'::jsonb)
  from newest
  where public.washdesk_safe_number(p_deleted->>(item->>'id'))
        < public.washdesk_record_stamp(item);
$$;

-- Enforce phone and vehicle registration uniqueness after cross-device merge.
-- Customer names intentionally are NOT unique: two different people can share a name.
create or replace function public.washdesk_assert_unique_customer_keys(p_payload jsonb)
returns void
language plpgsql
immutable
set search_path = public, pg_temp
as $
declare
  v_duplicate text;
begin
  select normalized_phone into v_duplicate
  from (
    select
      case
        when digits ~ '^91[0-9]{10}
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

  -- Serialize writers for this shared business account. Every device calls
  -- this function so two concurrent edits cannot replace each other's snapshot.
  insert into public.washdesk_sync(user_id, payload)
    values (v_user, '{}'::jsonb)
    on conflict (user_id) do nothing;

  select payload into v_existing
    from public.washdesk_sync
    where user_id = v_user
    for update;

  -- Keep the newest deletion timestamp for each deleted record ID.
  select coalesce(jsonb_object_agg(key, to_jsonb(max_stamp)), '{}'::jsonb)
    into v_deleted
    from (
      select key, max(public.washdesk_safe_number(value)) as max_stamp
      from (
        select key, value
          from jsonb_each_text(coalesce(v_existing->'_deletedIds', '{}'::jsonb))
        union all
        select key, value
          from jsonb_each_text(coalesce(p_payload->'_deletedIds', '{}'::jsonb))
      ) marker_rows
      group by key
    ) merged_markers;

  v_merged := v_existing || p_payload;
  v_merged := jsonb_set(v_merged, '{_deletedIds}', v_deleted, true);

  foreach v_collection in array array[
    'customers', 'vehicles', 'services', 'invoices', 'products',
    'purchases', 'expenses', 'staff', 'staffAdvances', 'payments'
  ] loop
    execute format(
      'select public.washdesk_merge_records($1->%L, $2->%L, $3)',
      v_collection, v_collection
    )
    into v_records
    using v_existing, p_payload, v_deleted;

    v_merged := jsonb_set(
      v_merged,
      array[v_collection],
      coalesce(v_records, '[]'::jsonb),
      true
    );
  end loop;

  -- Enforce unique customer mobiles and vehicle registrations across devices.
  -- Customer names may repeat and are not database primary keys.
  perform public.washdesk_assert_unique_customer_keys(v_merged);

  -- Business profile and app settings use their own update timestamps.
  if public.washdesk_record_stamp(coalesce(v_existing->'business', '{}'::jsonb))
     > public.washdesk_record_stamp(coalesce(p_payload->'business', '{}'::jsonb)) then
    v_merged := jsonb_set(v_merged, '{business}', v_existing->'business', true);
  end if;

  if public.washdesk_record_stamp(coalesce(v_existing->'settings', '{}'::jsonb))
     > public.washdesk_record_stamp(coalesce(p_payload->'settings', '{}'::jsonb)) then
    v_merged := jsonb_set(v_merged, '{settings}', v_existing->'settings', true);
  end if;

  v_merged := jsonb_set(
    v_merged,
    '{meta}',
    coalesce(v_existing->'meta', '{}'::jsonb) || coalesce(p_payload->'meta', '{}'::jsonb),
    true
  );

  update public.washdesk_sync
     set payload = v_merged, updated_at = now()
   where user_id = v_user;

  return v_merged;
end;
$$;

revoke all on function public.washdesk_safe_number(text) from public;
revoke all on function public.washdesk_record_stamp(jsonb) from public;
revoke all on function public.washdesk_merge_records(jsonb, jsonb, jsonb) from public;
revoke all on function public.washdesk_assert_unique_customer_keys(jsonb) from public;
revoke all on function public.washdesk_merge_sync(jsonb) from public;
grant execute on function public.washdesk_merge_sync(jsonb) to authenticated;

-- Shared atomic daily invoice counter for the same signed-in business account.
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
    set next_value = greatest(
      public.washdesk_invoice_counters.next_value + 1,
      excluded.next_value
    )
  returning next_value into v_seq;

  return v_prefix || '-' || to_char(p_date, 'YYMMDD') || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

revoke all on function public.washdesk_next_invoice_number(text, date, integer) from public;
grant execute on function public.washdesk_next_invoice_number(text, date, integer) to authenticated;

-- Supabase Realtime broadcasts committed changes to connected authenticated devices.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'washdesk_sync'
  ) then
    alter publication supabase_realtime add table public.washdesk_sync;
  end if;
end $$;
 then right(digits, 10)
        when digits ~ '^0[0-9]{10}
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

  -- Serialize writers for this shared business account. Every device calls
  -- this function so two concurrent edits cannot replace each other's snapshot.
  insert into public.washdesk_sync(user_id, payload)
    values (v_user, '{}'::jsonb)
    on conflict (user_id) do nothing;

  select payload into v_existing
    from public.washdesk_sync
    where user_id = v_user
    for update;

  -- Keep the newest deletion timestamp for each deleted record ID.
  select coalesce(jsonb_object_agg(key, to_jsonb(max_stamp)), '{}'::jsonb)
    into v_deleted
    from (
      select key, max(public.washdesk_safe_number(value)) as max_stamp
      from (
        select key, value
          from jsonb_each_text(coalesce(v_existing->'_deletedIds', '{}'::jsonb))
        union all
        select key, value
          from jsonb_each_text(coalesce(p_payload->'_deletedIds', '{}'::jsonb))
      ) marker_rows
      group by key
    ) merged_markers;

  v_merged := v_existing || p_payload;
  v_merged := jsonb_set(v_merged, '{_deletedIds}', v_deleted, true);

  foreach v_collection in array array[
    'customers', 'vehicles', 'services', 'invoices', 'products',
    'purchases', 'expenses', 'staff', 'payments'
  ] loop
    execute format(
      'select public.washdesk_merge_records($1->%L, $2->%L, $3)',
      v_collection, v_collection
    )
    into v_records
    using v_existing, p_payload, v_deleted;

    v_merged := jsonb_set(
      v_merged,
      array[v_collection],
      coalesce(v_records, '[]'::jsonb),
      true
    );
  end loop;

  -- Business profile and app settings use their own update timestamps.
  if public.washdesk_record_stamp(coalesce(v_existing->'business', '{}'::jsonb))
     > public.washdesk_record_stamp(coalesce(p_payload->'business', '{}'::jsonb)) then
    v_merged := jsonb_set(v_merged, '{business}', v_existing->'business', true);
  end if;

  if public.washdesk_record_stamp(coalesce(v_existing->'settings', '{}'::jsonb))
     > public.washdesk_record_stamp(coalesce(p_payload->'settings', '{}'::jsonb)) then
    v_merged := jsonb_set(v_merged, '{settings}', v_existing->'settings', true);
  end if;

  v_merged := jsonb_set(
    v_merged,
    '{meta}',
    coalesce(v_existing->'meta', '{}'::jsonb) || coalesce(p_payload->'meta', '{}'::jsonb),
    true
  );

  update public.washdesk_sync
     set payload = v_merged, updated_at = now()
   where user_id = v_user;

  return v_merged;
end;
$$;

revoke all on function public.washdesk_safe_number(text) from public;
revoke all on function public.washdesk_record_stamp(jsonb) from public;
revoke all on function public.washdesk_merge_records(jsonb, jsonb, jsonb) from public;
revoke all on function public.washdesk_merge_sync(jsonb) from public;
grant execute on function public.washdesk_merge_sync(jsonb) to authenticated;

-- Shared atomic daily invoice counter for the same signed-in business account.
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
    set next_value = greatest(
      public.washdesk_invoice_counters.next_value + 1,
      excluded.next_value
    )
  returning next_value into v_seq;

  return v_prefix || '-' || to_char(p_date, 'YYMMDD') || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

revoke all on function public.washdesk_next_invoice_number(text, date, integer) from public;
grant execute on function public.washdesk_next_invoice_number(text, date, integer) to authenticated;

-- Supabase Realtime broadcasts committed changes to connected authenticated devices.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'washdesk_sync'
  ) then
    alter publication supabase_realtime add table public.washdesk_sync;
  end if;
end $$;
 then right(digits, 10)
        else digits
      end as normalized_phone
    from (
      select regexp_replace(coalesce(item->>'phone', ''), '[^0-9]', '', 'g') as digits
      from jsonb_array_elements(
        case when jsonb_typeof(p_payload->'customers') = 'array'
          then p_payload->'customers' else '[]'::jsonb end
      ) as customer_rows(item)
    ) raw_phones
  ) normalized_phones
  where normalized_phone <> ''
  group by normalized_phone
  having count(*) > 1
  limit 1;

  if v_duplicate is not null then
    raise exception using
      errcode = '23505',
      message = 'DUPLICATE_CUSTOMER_MOBILE',
      detail = 'The same normalized mobile number is assigned to more than one customer: ' || v_duplicate;
  end if;

  select normalized_registration into v_duplicate
  from (
    select upper(regexp_replace(coalesce(item->>'number', ''), '[^A-Z0-9]', '', 'g')) as normalized_registration
    from jsonb_array_elements(
      case when jsonb_typeof(p_payload->'vehicles') = 'array'
        then p_payload->'vehicles' else '[]'::jsonb end
    ) as vehicle_rows(item)
  ) normalized_vehicles
  where normalized_registration <> ''
  group by normalized_registration
  having count(*) > 1
  limit 1;

  if v_duplicate is not null then
    raise exception using
      errcode = '23505',
      message = 'DUPLICATE_VEHICLE_REGISTRATION',
      detail = 'The same normalized vehicle registration number is assigned to more than one vehicle: ' || v_duplicate;
  end if;
end;
$;

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

  -- Serialize writers for this shared business account. Every device calls
  -- this function so two concurrent edits cannot replace each other's snapshot.
  insert into public.washdesk_sync(user_id, payload)
    values (v_user, '{}'::jsonb)
    on conflict (user_id) do nothing;

  select payload into v_existing
    from public.washdesk_sync
    where user_id = v_user
    for update;

  -- Keep the newest deletion timestamp for each deleted record ID.
  select coalesce(jsonb_object_agg(key, to_jsonb(max_stamp)), '{}'::jsonb)
    into v_deleted
    from (
      select key, max(public.washdesk_safe_number(value)) as max_stamp
      from (
        select key, value
          from jsonb_each_text(coalesce(v_existing->'_deletedIds', '{}'::jsonb))
        union all
        select key, value
          from jsonb_each_text(coalesce(p_payload->'_deletedIds', '{}'::jsonb))
      ) marker_rows
      group by key
    ) merged_markers;

  v_merged := v_existing || p_payload;
  v_merged := jsonb_set(v_merged, '{_deletedIds}', v_deleted, true);

  foreach v_collection in array array[
    'customers', 'vehicles', 'services', 'invoices', 'products',
    'purchases', 'expenses', 'staff', 'payments'
  ] loop
    execute format(
      'select public.washdesk_merge_records($1->%L, $2->%L, $3)',
      v_collection, v_collection
    )
    into v_records
    using v_existing, p_payload, v_deleted;

    v_merged := jsonb_set(
      v_merged,
      array[v_collection],
      coalesce(v_records, '[]'::jsonb),
      true
    );
  end loop;

  -- Business profile and app settings use their own update timestamps.
  if public.washdesk_record_stamp(coalesce(v_existing->'business', '{}'::jsonb))
     > public.washdesk_record_stamp(coalesce(p_payload->'business', '{}'::jsonb)) then
    v_merged := jsonb_set(v_merged, '{business}', v_existing->'business', true);
  end if;

  if public.washdesk_record_stamp(coalesce(v_existing->'settings', '{}'::jsonb))
     > public.washdesk_record_stamp(coalesce(p_payload->'settings', '{}'::jsonb)) then
    v_merged := jsonb_set(v_merged, '{settings}', v_existing->'settings', true);
  end if;

  v_merged := jsonb_set(
    v_merged,
    '{meta}',
    coalesce(v_existing->'meta', '{}'::jsonb) || coalesce(p_payload->'meta', '{}'::jsonb),
    true
  );

  update public.washdesk_sync
     set payload = v_merged, updated_at = now()
   where user_id = v_user;

  return v_merged;
end;
$$;

revoke all on function public.washdesk_safe_number(text) from public;
revoke all on function public.washdesk_record_stamp(jsonb) from public;
revoke all on function public.washdesk_merge_records(jsonb, jsonb, jsonb) from public;
revoke all on function public.washdesk_merge_sync(jsonb) from public;
grant execute on function public.washdesk_merge_sync(jsonb) to authenticated;

-- Shared atomic daily invoice counter for the same signed-in business account.
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
    set next_value = greatest(
      public.washdesk_invoice_counters.next_value + 1,
      excluded.next_value
    )
  returning next_value into v_seq;

  return v_prefix || '-' || to_char(p_date, 'YYMMDD') || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

revoke all on function public.washdesk_next_invoice_number(text, date, integer) from public;
grant execute on function public.washdesk_next_invoice_number(text, date, integer) to authenticated;

-- Supabase Realtime broadcasts committed changes to connected authenticated devices.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'washdesk_sync'
  ) then
    alter publication supabase_realtime add table public.washdesk_sync;
  end if;
end $$;
