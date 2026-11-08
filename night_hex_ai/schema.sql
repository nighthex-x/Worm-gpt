
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

-- NIGHT HEX AI advanced controls, announcements, analytics and conversation sharing
create table if not exists public.site_settings (
  id integer primary key check (id = 1),
  maintenance_enabled boolean not null default false,
  maintenance_message text not null default 'NIGHT HEX AI is temporarily under maintenance. Please try again later.',
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  category text not null default 'general',
  created_at timestamptz not null default now()
);
create index if not exists usage_events_created_idx on public.usage_events(created_at desc);
create index if not exists usage_events_user_created_idx on public.usage_events(user_id,created_at desc);

create table if not exists public.shared_chats (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(chat_id,user_id)
);

alter table public.site_settings enable row level security;
alter table public.announcements enable row level security;
alter table public.usage_events enable row level security;
alter table public.shared_chats enable row level security;

drop policy if exists "Public can read announcements" on public.announcements;
create policy "Public can read announcements" on public.announcements for select using (active = true);
drop policy if exists "Users can read own shared chat records" on public.shared_chats;
create policy "Users can read own shared chat records" on public.shared_chats for select using (auth.uid() = user_id);
drop policy if exists "Users can create own shared chat records" on public.shared_chats;
create policy "Users can create own shared chat records" on public.shared_chats for insert with check (auth.uid() = user_id and exists (select 1 from public.chats c where c.id = chat_id and c.user_id = auth.uid()));
drop policy if exists "Users can delete own shared chat records" on public.shared_chats;
create policy "Users can delete own shared chat records" on public.shared_chats for delete using (auth.uid() = user_id);
-- No client policies for site_settings or usage_events. Service role accesses them server-side.
