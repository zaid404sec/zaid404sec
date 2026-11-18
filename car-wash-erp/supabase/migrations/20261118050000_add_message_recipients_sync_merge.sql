-- Created as a versioned additive migration for WashDesk 2.9.2.
-- Extends only the existing server-side JSON merge collection list.
-- No existing rows, table definitions, workspace memberships or invoice counters are removed.

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
    'purchases', 'expenses', 'staff', 'staffAdvances', 'attendance', 'payments', 'messageRecipients'
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
