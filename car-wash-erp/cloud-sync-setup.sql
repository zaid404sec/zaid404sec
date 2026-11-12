-- Prime Auto Care: one shared database for all phones and the Windows laptop.
-- Run this complete file ONCE in Supabase Dashboard -> SQL Editor.
-- The final SELECT returns a private 64-character device pairing code.
-- Enter that SAME code once on every Prime Auto Care device.
-- No email links, SMTP, database password, or service-role key are used by the app.

create table if not exists public.washdesk_workspaces (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default 'Prime Auto Care',
  pairing_code text not null unique,
  owner_auth_user_id uuid references auth.users(id),
  singleton_key boolean not null default true unique check (singleton_key),
  created_at timestamptz not null default now()
);

create table if not exists public.washdesk_workspace_members (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now()
);

alter table public.washdesk_workspaces enable row level security;
alter table public.washdesk_workspace_members enable row level security;
revoke all on public.washdesk_workspaces from anon, authenticated;
revoke all on public.washdesk_workspace_members from anon, authenticated;

-- Keep the existing sync row shape so an already-created single-device data
-- row can be adopted as the shared workspace owner without deleting its data.
create table if not exists public.washdesk_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.washdesk_sync enable row level security;
alter table public.washdesk_sync replica identity full;
revoke all on public.washdesk_sync from anon, authenticated;
grant select on public.washdesk_sync to authenticated;

-- Generate or return the workspace's one-time pairing code. Existing legacy
-- sync data is preserved by adopting its single owner UUID when present.
create or replace function public.washdesk_create_pairing_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_legacy_count bigint;
  v_legacy_owner uuid;
  v_workspace_id uuid;
begin
  select id, pairing_code
    into v_workspace_id, v_code
    from public.washdesk_workspaces
    limit 1;

  if v_workspace_id is not null then
    return v_code;
  end if;

  select count(*), (array_agg(user_id))[1]
    into v_legacy_count, v_legacy_owner
    from public.washdesk_sync;

  if v_legacy_count > 1 then
    raise exception 'MULTIPLE_LEGACY_SYNC_OWNERS: More than one old cloud owner row exists. Do not overwrite it; contact support to merge the old cloud rows safely.';
  end if;

  v_code := upper(
    replace(gen_random_uuid()::text, '-', '') ||
    replace(gen_random_uuid()::text, '-', '')
  );

  insert into public.washdesk_workspaces (
    business_name, pairing_code, owner_auth_user_id
  ) values (
    'Prime Auto Care', v_code, v_legacy_owner
  ) returning id into v_workspace_id;

  if v_legacy_owner is not null then
    insert into public.washdesk_workspace_members(auth_user_id, workspace_id, role)
    values (v_legacy_owner, v_workspace_id, 'owner')
    on conflict (auth_user_id) do update
      set workspace_id = excluded.workspace_id, role = 'owner';
  end if;

  return v_code;
end;
$$;
revoke all on function public.washdesk_create_pairing_code() from public, anon, authenticated;
grant execute on function public.washdesk_create_pairing_code() to postgres;

-- A device authenticates anonymously (no email), then joins using the private
-- pairing code. The first device becomes owner; the next devices are members.
create or replace function public.washdesk_join_workspace(p_pairing_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user uuid := auth.uid();
  v_workspace_id uuid;
  v_owner_user uuid;
  v_code text := upper(regexp_replace(coalesce(p_pairing_code, ''), '\s', '', 'g'));
  v_role text;
  v_business_name text;
begin
  if v_auth_user is null then
    raise exception 'AUTHENTICATION_REQUIRED: Secure device sign-in is required.';
  end if;
  if length(v_code) <> 64 then
    raise exception 'INVALID_PAIRING_CODE: Pairing code must be 64 characters.';
  end if;

  select id, owner_auth_user_id, business_name
    into v_workspace_id, v_owner_user, v_business_name
    from public.washdesk_workspaces
    where pairing_code = v_code
    for update;

  if v_workspace_id is null then
    raise exception 'INVALID_PAIRING_CODE: The pairing code is not valid for this project.';
  end if;

  if v_owner_user is null then
    update public.washdesk_workspaces
      set owner_auth_user_id = v_auth_user
      where id = v_workspace_id;
    v_owner_user := v_auth_user;
  end if;

  v_role := case when v_owner_user = v_auth_user then 'owner' else 'member' end;

  insert into public.washdesk_workspace_members(auth_user_id, workspace_id, role)
  values (v_auth_user, v_workspace_id, v_role)
  on conflict (auth_user_id) do update
    set workspace_id = excluded.workspace_id,
        role = excluded.role;

  return jsonb_build_object(
    'workspace_id', v_workspace_id,
    'owner_user_id', v_owner_user,
    'business_name', v_business_name,
    'role', v_role
  );
end;
$$;

create or replace function public.washdesk_get_workspace()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'workspace_id', w.id,
    'owner_user_id', w.owner_auth_user_id,
    'business_name', w.business_name,
    'role', m.role
  )
  from public.washdesk_workspace_members m
  join public.washdesk_workspaces w on w.id = m.workspace_id
  where m.auth_user_id = auth.uid()
  limit 1;
$$;

-- RLS helper: a signed-in device can read the shared sync row only when it is
-- a member of the workspace whose canonical owner UUID is that row's user_id.
create or replace function public.washdesk_can_read_sync(p_owner_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.washdesk_workspace_members m
    join public.washdesk_workspaces w on w.id = m.workspace_id
    where m.auth_user_id = auth.uid()
      and w.owner_auth_user_id = p_owner_user_id
  );
$$;

revoke all on function public.washdesk_join_workspace(text) from public, anon;
revoke all on function public.washdesk_get_workspace() from public, anon;
revoke all on function public.washdesk_can_read_sync(uuid) from public, anon;
grant execute on function public.washdesk_join_workspace(text) to authenticated;
grant execute on function public.washdesk_get_workspace() to authenticated;
grant execute on function public.washdesk_can_read_sync(uuid) to authenticated;

drop policy if exists "WashDesk users can read own data" on public.washdesk_sync;
drop policy if exists "Prime Auto Care users can read own data" on public.washdesk_sync;
drop policy if exists "Prime Auto Care workspace members can read shared data" on public.washdesk_sync;
create policy "Prime Auto Care workspace members can read shared data"
  on public.washdesk_sync for select
  to authenticated
  using (public.washdesk_can_read_sync(user_id));

create or replace function public.washdesk_safe_number(p_value text)
returns numeric
language plpgsql
immutable
set search_path = ''
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
set search_path = ''
as $$
  select greatest(
    public.washdesk_safe_number(p_record->>'updatedAt'),
    public.washdesk_safe_number(p_record->>'editedAt'),
    public.washdesk_safe_number(p_record->>'createdAt')
  );
$$;

create or replace function public.washdesk_merge_records(
  p_local jsonb,
  p_remote jsonb,
  p_deleted jsonb
) returns jsonb
language sql
immutable
set search_path = ''
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

-- Customer names may repeat. Mobile numbers and vehicle registrations may not.
create or replace function public.washdesk_assert_unique_customer_keys(p_payload jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_duplicate text;
begin
  select normalized_phone into v_duplicate
  from (
    select
      case
        when digits ~ '^0091[0-9]{10}$' then right(digits, 10)
        when digits ~ '^91[0-9]{10}$' then right(digits, 10)
        when digits ~ '^0[0-9]{10}$' then right(digits, 10)
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
    select regexp_replace(upper(coalesce(item->>'number', '')), '[^A-Z0-9]', '', 'g') as normalized_registration
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
$$;

create or replace function public.washdesk_merge_sync(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user uuid := auth.uid();
  v_owner_user uuid;
  v_existing jsonb := '{}'::jsonb;
  v_merged jsonb;
  v_deleted jsonb := '{}'::jsonb;
  v_records jsonb;
  v_collection text;
  v_product jsonb;
  v_existing_product jsonb;
  v_products jsonb := '[]'::jsonb;
  v_product_id text;
  v_opening numeric;
  v_movement_delta numeric;
  v_stock_qty numeric;
begin
  if v_auth_user is null then
    raise exception 'Authentication required';
  end if;

  select w.owner_auth_user_id into v_owner_user
    from public.washdesk_workspace_members m
    join public.washdesk_workspaces w on w.id = m.workspace_id
    where m.auth_user_id = v_auth_user
    limit 1;

  if v_owner_user is null then
    raise exception 'DEVICE_NOT_PAIRED: Connect this device to the Prime Auto Care workspace using the pairing code.';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'A valid business data object is required';
  end if;
  if octet_length(p_payload::text) > 8000000 then
    raise exception 'Business data exceeds the 8 MB sync limit. Export a backup and contact support.';
  end if;
  if coalesce(p_payload->'meta'->>'stockLedgerVersion','') <> '1' then
    raise exception using
      errcode = 'P0001',
      message = 'APP_UPDATE_REQUIRED',
      detail = 'Install Prime Auto Care 2.5.2 on this device before syncing stock changes.';
  end if;

  insert into public.washdesk_sync(user_id, payload)
    values (v_owner_user, '{}'::jsonb)
    on conflict (user_id) do nothing;

  select payload into v_existing
    from public.washdesk_sync
    where user_id = v_owner_user
    for update;

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
    'customers', 'vehicles', 'services', 'invoices', 'products', 'stockMovements',
    'purchases', 'expenses', 'staff', 'staffAdvances', 'attendance', 'payments'
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

  perform public.washdesk_assert_unique_customer_keys(v_merged);

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

  -- The canonical opening quantity is captured from the current server snapshot
  -- on first migration. New/edited stock is never taken from a stale client qty;
  -- only unique append-only stock movement rows change the authoritative balance.
  for v_product in
    select item
      from jsonb_array_elements(coalesce(v_merged->'products', '[]'::jsonb)) as product_rows(item)
  loop
    v_product_id := coalesce(v_product->>'id', '');
    select item into v_existing_product
      from jsonb_array_elements(coalesce(v_existing->'products', '[]'::jsonb)) as existing_rows(item)
      where item->>'id' = v_product_id
      limit 1;

    if v_existing_product is not null then
      v_opening := public.washdesk_safe_number(
        coalesce(v_existing_product->>'stockOpeningQty', v_existing_product->>'qty')
      );
    else
      v_opening := public.washdesk_safe_number(
        coalesce(v_product->>'stockOpeningQty', v_product->>'qty')
      );
    end if;

    select coalesce(sum(public.washdesk_safe_number(item->>'delta')), 0)
      into v_movement_delta
      from jsonb_array_elements(coalesce(v_merged->'stockMovements', '[]'::jsonb)) as movement_rows(item)
      where item->>'productId' = v_product_id;

    v_stock_qty := v_opening + coalesce(v_movement_delta, 0);
    if v_stock_qty < -0.000001 then
      raise exception using
        errcode = '23514',
        message = 'INSUFFICIENT_STOCK',
        detail = 'The combined stock movements would make product ' || v_product_id || ' negative. The cloud transaction was rejected; review the pending invoice or adjustment on its source device.';
    end if;

    v_product := jsonb_set(v_product, '{stockOpeningQty}', to_jsonb(v_opening), true);
    v_product := jsonb_set(v_product, '{qty}', to_jsonb(greatest(0, v_stock_qty)), true);
    v_products := v_products || jsonb_build_array(v_product);
    v_existing_product := null;
  end loop;

  v_merged := jsonb_set(v_merged, '{products}', v_products, true);
  v_merged := jsonb_set(
    v_merged,
    '{meta,serverStockLedgerVersion}',
    '1'::jsonb,
    true
  );

  update public.washdesk_sync
     set payload = v_merged, updated_at = now()
   where user_id = v_owner_user;

  return v_merged;
end;
$$;

revoke all on function public.washdesk_merge_sync(jsonb) from public, anon;
grant execute on function public.washdesk_merge_sync(jsonb) to authenticated;

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
set search_path = ''
as $$
declare
  v_auth_user uuid := auth.uid();
  v_owner_user uuid;
  v_seq integer;
  v_prefix text;
begin
  if v_auth_user is null then
    raise exception 'Authentication required';
  end if;

  select w.owner_auth_user_id into v_owner_user
    from public.washdesk_workspace_members m
    join public.washdesk_workspaces w on w.id = m.workspace_id
    where m.auth_user_id = v_auth_user
    limit 1;

  if v_owner_user is null then
    raise exception 'DEVICE_NOT_PAIRED: Connect this device with the shared pairing code.';
  end if;

  v_prefix := upper(left(regexp_replace(coalesce(p_prefix, 'CW'), '[^A-Za-z0-9-]', '', 'g'), 4));
  if v_prefix = '' then v_prefix := 'CW'; end if;

  insert into public.washdesk_invoice_counters(user_id, invoice_date, next_value)
    values (v_owner_user, p_date, greatest(1, coalesce(p_min_next_value, 1)))
  on conflict (user_id, invoice_date) do update
    set next_value = greatest(
      public.washdesk_invoice_counters.next_value + 1,
      excluded.next_value
    )
  returning next_value into v_seq;

  return v_prefix || '-' || to_char(p_date, 'YYMMDD') || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

revoke all on function public.washdesk_next_invoice_number(text, date, integer) from public, anon;
grant execute on function public.washdesk_next_invoice_number(text, date, integer) to authenticated;

-- Enable change events so all paired phones and the laptop update live.
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

-- The final query returns a long random pairing code. Keep it private and use it
-- once on every device. Re-running this file returns the same code.
select public.washdesk_create_pairing_code() as "Prime Auto Care device pairing code";
