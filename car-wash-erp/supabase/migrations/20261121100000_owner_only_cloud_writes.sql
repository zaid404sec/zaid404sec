do $migration$
declare
  v_definition text;
  v_original text;
begin
  v_definition := pg_get_functiondef('public.washdesk_merge_sync(jsonb)'::regprocedure);
  v_original := v_definition;
  if position('and m.role = ''owner''' in lower(v_definition)) = 0 then
    v_definition := replace(
      v_definition,
      'where m.auth_user_id = v_auth_user',
      'where m.auth_user_id = v_auth_user' || E'\n    and m.role = ''owner'''
    );
    if v_definition = v_original then
      raise exception 'Could not safely apply Owner-only guard to washdesk_merge_sync(jsonb)';
    end if;
    execute v_definition;
  end if;

  v_definition := pg_get_functiondef('public.washdesk_next_invoice_number(text,date,integer)'::regprocedure);
  v_original := v_definition;
  if position('and m.role = ''owner''' in lower(v_definition)) = 0 then
    v_definition := replace(
      v_definition,
      'where m.auth_user_id = v_auth_user',
      'where m.auth_user_id = v_auth_user' || E'\n    and m.role = ''owner'''
    );
    if v_definition = v_original then
      raise exception 'Could not safely apply Owner-only guard to washdesk_next_invoice_number(text,date,integer)';
    end if;
    execute v_definition;
  end if;
end
$migration$;
