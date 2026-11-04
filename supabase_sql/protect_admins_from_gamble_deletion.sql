-- Replace the existing delete_my_account function with this protected version.
-- Admins are identified by the existing public.admins(user_id) table.

drop function if exists public.delete_my_account();

create or replace function public.delete_my_account()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'You must be signed in';
  end if;

  if exists (
    select 1
    from public.admins
    where user_id = current_user_id
  ) then
    update public.comments
    set is_admin = false
    where user_id = current_user_id;

    delete from public.admins
    where user_id = current_user_id;
    return false;
  end if;

  delete from public.comments where user_id = current_user_id;
  delete from public.chat_messages where user_id = current_user_id;
  delete from public.profiles where id = current_user_id;
  return true;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
