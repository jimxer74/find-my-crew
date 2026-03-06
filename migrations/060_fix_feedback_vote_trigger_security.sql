-- Migration: Simplify feedback voting - replace trigger with atomic RPC
--
-- Problem: The trigger approach failed because RLS blocked the trigger from
-- updating feedback.upvotes on rows owned by other users.
--
-- Solution: Drop the trigger entirely. Create a SECURITY DEFINER RPC function
-- that atomically toggles a vote and updates feedback.upvotes directly.
-- Only upvotes are supported (no downvotes).

-- Drop old trigger and function
drop trigger if exists trigger_update_feedback_votes on public.feedback_votes;
drop function if exists update_feedback_vote_counts();

-- Drop vote_score generated column (depends on downvotes, must drop first)
alter table public.feedback drop column if exists vote_score;

-- Drop downvotes column (not needed - only upvotes)
alter table public.feedback drop column if exists downvotes;

-- Atomic toggle-vote RPC: handles insert/delete in feedback_votes and
-- increments/decrements feedback.upvotes in one transaction.
-- SECURITY DEFINER runs as postgres (BYPASSRLS) so it can update any feedback row.
create or replace function toggle_feedback_vote(p_feedback_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_existing_id uuid;
  v_new_upvotes integer;
  v_user_voted boolean;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  -- Cannot vote on own feedback
  if exists (select 1 from public.feedback where id = p_feedback_id and user_id = v_user_id) then
    return jsonb_build_object('error', 'Cannot vote on your own feedback');
  end if;

  -- Check for existing vote
  select id into v_existing_id
  from public.feedback_votes
  where feedback_id = p_feedback_id and user_id = v_user_id;

  if v_existing_id is not null then
    -- Remove vote (toggle off)
    delete from public.feedback_votes where id = v_existing_id;
    update public.feedback
      set upvotes = greatest(0, upvotes - 1), updated_at = now()
      where id = p_feedback_id;
    v_user_voted := false;
  else
    -- Add vote (toggle on)
    insert into public.feedback_votes (feedback_id, user_id, vote)
      values (p_feedback_id, v_user_id, 1);
    update public.feedback
      set upvotes = upvotes + 1, updated_at = now()
      where id = p_feedback_id;
    v_user_voted := true;
  end if;

  select upvotes into v_new_upvotes from public.feedback where id = p_feedback_id;

  return jsonb_build_object('upvotes', v_new_upvotes, 'user_voted', v_user_voted);
end;
$$;

grant execute on function toggle_feedback_vote(uuid) to authenticated;
