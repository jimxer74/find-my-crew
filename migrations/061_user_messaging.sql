-- ============================================================================
-- Migration 061: User Messaging System
-- Adds conversations and conversation_messages tables.
-- Conversations are opened when a registration is approved.
-- Only the two participants can read/write their conversation and messages.
-- ============================================================================

-- Conversation status enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'conversation_status') then
    create type conversation_status as enum ('open', 'closed');
  end if;
end$$;

-- ============================================================================
-- TABLE: conversations
-- One conversation per registration (unique constraint).
-- participant_1_id = crew (registrant), participant_2_id = skipper (owner).
-- ============================================================================

create table if not exists public.conversations (
  id                  uuid primary key default gen_random_uuid(),
  registration_id     uuid not null references public.registrations(id) on delete cascade,
  participant_1_id    uuid not null references auth.users(id) on delete cascade,  -- crew
  participant_2_id    uuid not null references auth.users(id) on delete cascade,  -- skipper/owner
  status              conversation_status not null default 'open',
  closed_at           timestamptz,
  closed_by           uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint conversations_registration_unique unique (registration_id)
);

create index if not exists idx_conversations_participant_1 on public.conversations(participant_1_id);
create index if not exists idx_conversations_participant_2 on public.conversations(participant_2_id);
create index if not exists idx_conversations_registration on public.conversations(registration_id);
create index if not exists idx_conversations_status on public.conversations(status);

alter table public.conversations enable row level security;

-- Only participants can view the conversation
create policy "Participants can view their conversations"
  on public.conversations for select
  using (participant_1_id = auth.uid() or participant_2_id = auth.uid());

-- System/service can insert (via SECURITY DEFINER function)
create policy "Service can insert conversations"
  on public.conversations for insert
  with check (participant_1_id = auth.uid() or participant_2_id = auth.uid());

-- Participants can close (update status)
create policy "Participants can update their conversations"
  on public.conversations for update
  using (participant_1_id = auth.uid() or participant_2_id = auth.uid());


-- ============================================================================
-- TABLE: conversation_messages
-- Messages within a conversation. Supports text + optional attachments (jsonb).
-- read_by is an array of user UUIDs who have read the message.
-- ============================================================================

create table if not exists public.conversation_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  content         text not null,
  attachments     jsonb default '[]',  -- [{type, url, name, vault_document_id?}]
  read_by         uuid[] default '{}', -- array of user IDs who have read this message
  created_at      timestamptz not null default now()
);

create index if not exists idx_conversation_messages_conversation on public.conversation_messages(conversation_id);
create index if not exists idx_conversation_messages_sender on public.conversation_messages(sender_id);
create index if not exists idx_conversation_messages_created on public.conversation_messages(conversation_id, created_at desc);

alter table public.conversation_messages enable row level security;

-- Only participants of the conversation can read messages
create policy "Participants can view messages"
  on public.conversation_messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_messages.conversation_id
        and (c.participant_1_id = auth.uid() or c.participant_2_id = auth.uid())
    )
  );

-- Only participants can send messages (and only if conversation is open)
create policy "Participants can insert messages"
  on public.conversation_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_messages.conversation_id
        and (c.participant_1_id = auth.uid() or c.participant_2_id = auth.uid())
        and c.status = 'open'
    )
  );

-- Participants can update read_by on messages
create policy "Participants can update messages"
  on public.conversation_messages for update
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_messages.conversation_id
        and (c.participant_1_id = auth.uid() or c.participant_2_id = auth.uid())
    )
  );


-- ============================================================================
-- RPC: open_conversation_for_registration
-- Called when a registration is approved. Creates a conversation if one does
-- not already exist for this registration.
-- SECURITY DEFINER so it can bypass RLS on conversations insert.
-- ============================================================================

create or replace function public.open_conversation_for_registration(
  p_registration_id uuid,
  p_crew_id         uuid,
  p_skipper_id      uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  -- Idempotent: return existing conversation if already created
  select id into v_conversation_id
  from public.conversations
  where registration_id = p_registration_id;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (registration_id, participant_1_id, participant_2_id)
  values (p_registration_id, p_crew_id, p_skipper_id)
  returning id into v_conversation_id;

  return v_conversation_id;
end;
$$;

grant execute on function public.open_conversation_for_registration(uuid, uuid, uuid) to authenticated;


-- ============================================================================
-- RPC: mark_messages_read
-- Atomically marks given messages as read by a user (appends user_id to read_by).
-- SECURITY DEFINER to avoid array update RLS complexity.
-- ============================================================================

create or replace function public.mark_messages_read(
  p_message_ids uuid[],
  p_user_id     uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only mark messages that the user can actually see (they are a participant)
  update public.conversation_messages m
  set read_by = array_append(read_by, p_user_id)
  from public.conversations c
  where m.id = any(p_message_ids)
    and c.id = m.conversation_id
    and (c.participant_1_id = p_user_id or c.participant_2_id = p_user_id)
    and not (read_by @> array[p_user_id]);  -- don't double-add
end;
$$;

grant execute on function public.mark_messages_read(uuid[], uuid) to authenticated;


-- ============================================================================
-- Enable Supabase Realtime on conversation_messages
-- Run in Supabase dashboard if not already configured:
--   alter publication supabase_realtime add table conversation_messages;
-- ============================================================================
