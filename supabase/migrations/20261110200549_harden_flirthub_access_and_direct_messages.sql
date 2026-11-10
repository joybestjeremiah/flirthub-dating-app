-- Harden selected FlirtHub RPC grants and direct-message entitlement checks.
revoke execute on function public.admin_referral_recent(integer) from public, anon;
grant execute on function public.admin_referral_recent(integer) to authenticated, service_role;
revoke execute on function public.admin_referral_stats() from public, anon;
grant execute on function public.admin_referral_stats() to authenticated, service_role;
revoke execute on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated, service_role;
revoke execute on function public.create_match_call(uuid, text) from public, anon;
grant execute on function public.create_match_call(uuid, text) to authenticated, service_role;
revoke execute on function public.get_room_members_with_profiles(uuid) from public, anon;
grant execute on function public.get_room_members_with_profiles(uuid) to authenticated, service_role;
create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid)
returns boolean language sql security definer set search_path = public
as $function$
  select auth.uid() is not null and p_user_id = auth.uid()
    and exists (select 1 from public.room_members rm where rm.room_id = p_room_id and rm.user_id = auth.uid());
$function$;
revoke execute on function public.is_room_member(uuid, uuid) from public, anon;
grant execute on function public.is_room_member(uuid, uuid) to authenticated, service_role;
revoke execute on function public.set_my_presence(boolean) from public, anon;
grant execute on function public.set_my_presence(boolean) to authenticated, service_role;
revoke execute on function public.generate_referral_code() from public, anon;
grant execute on function public.generate_referral_code() to authenticated, service_role;
revoke execute on function public.ensure_profile_referral_code() from public, anon, authenticated;
revoke execute on function public.notify_match_recipient_on_message() from public, anon, authenticated;
revoke execute on function public.reward_referrer_on_subscription() from public, anon, authenticated;
drop policy if exists direct_messages_insert_premium_participant on public.direct_messages;
create policy direct_messages_insert_premium_participant on public.direct_messages for insert to authenticated
with check (
 sender = (select auth.uid())
 and exists (select 1 from public.direct_conversations c where c.id = direct_messages.conversation_id
   and (c.user1 = (select auth.uid()) or c.user2 = (select auth.uid()))
   and not exists (select 1 from public.blocks b where
     (b.blocker = c.user1 and b.blocked = c.user2) or (b.blocker = c.user2 and b.blocked = c.user1)))
 and exists (select 1 from public.subscriptions s where s.user_id = (select auth.uid())
   and s.status = 'active' and (s.expires_at is null or s.expires_at > now()))
);
