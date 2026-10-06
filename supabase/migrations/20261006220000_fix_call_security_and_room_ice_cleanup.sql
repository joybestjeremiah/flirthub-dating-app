-- Keep match-call creation authenticated and make ICE cleanup work for both match and room calls.

create or replace function public.create_match_call(p_match_id uuid, p_call_type text)
returns public.calls
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_call public.calls;
  v_callee uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_call_type not in ('audio','video') then
    raise exception 'Invalid call type';
  end if;

  select case when m.user1 = auth.uid() then m.user2 else m.user1 end
    into v_callee
  from public.matches m
  where m.id = p_match_id
    and (m.user1 = auth.uid() or m.user2 = auth.uid());

  if v_callee is null then
    raise exception 'Match not found';
  end if;

  insert into public.calls(match_id, caller, callee, call_type, status)
  values(p_match_id, auth.uid(), v_callee, p_call_type, 'initiated')
  returning * into v_call;

  return v_call;
end;
$function$;

revoke all on function public.create_match_call(uuid,text) from public;
grant execute on function public.create_match_call(uuid,text) to authenticated;

create or replace function public.cleanup_call_ice_candidates(p_call_id uuid)
returns integer
language plpgsql
set search_path = public
as $function$
declare
  removed integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.calls c
    left join public.matches m on m.id = c.match_id
    left join public.rooms r on r.id = c.room_id
    where c.id = p_call_id
      and (
        c.caller = auth.uid()
        or c.callee = auth.uid()
        or (m.id is not null and (m.user1 = auth.uid() or m.user2 = auth.uid()))
        or (r.id is not null and (
          r.owner = auth.uid()
          or exists (
            select 1
            from public.room_members rm
            where rm.room_id = r.id
              and rm.user_id = auth.uid()
          )
        ))
      )
  ) then
    raise exception 'Not authorized for this call';
  end if;

  delete from public.call_ice_candidates where call_id = p_call_id;
  get diagnostics removed = row_count;
  return removed;
end;
$function$;
