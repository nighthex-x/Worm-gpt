
-- NIGHT HEX AI - Supabase Database Setup

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chats_user_updated_idx
on public.chats(user_id, updated_at desc);

create index if not exists messages_chat_created_idx
on public.messages(chat_id, created_at);

alter table public.chats enable row level security;
alter table public.messages enable row level security;

-- Remove old policies if they already exist

drop policy if exists "Users can read own chats" on public.chats;
drop policy if exists "Users can create own chats" on public.chats;
drop policy if exists "Users can update own chats" on public.chats;
drop policy if exists "Users can delete own chats" on public.chats;

drop policy if exists "Users can read own messages" on public.messages;
drop policy if exists "Users can create own messages" on public.messages;
drop policy if exists "Users can delete own messages" on public.messages;

-- Create policies again

create policy "Users can read own chats"
on public.chats for select
using (auth.uid() = user_id);

create policy "Users can create own chats"
on public.chats for insert
with check (auth.uid() = user_id);

create policy "Users can update own chats"
on public.chats for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own chats"
on public.chats for delete
using (auth.uid() = user_id);

create policy "Users can read own messages"
on public.messages for select
using (auth.uid() = user_id);

create policy "Users can create own messages"
on public.messages for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.chats c
    where c.id = chat_id
    and c.user_id = auth.uid()
  )
);

create policy "Users can delete own messages"
on public.messages for delete
using (auth.uid() = user_id);
