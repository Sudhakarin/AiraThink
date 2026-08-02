-- ============================================================
-- Thinkchat database schema
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_color text not null default '#7C5CFF',
  status text not null default 'offline',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  name text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;

create policy "Participants can view their conversations"
  on public.conversations for select
  to authenticated
  using (
    id in (select conversation_id from public.conversation_participants where user_id = auth.uid())
  );

create policy "Authenticated users can create conversations"
  on public.conversations for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "Participants can view participant rows"
  on public.conversation_participants for select
  to authenticated
  using (
    conversation_id in (select conversation_id from public.conversation_participants where user_id = auth.uid())
  );

create policy "Users can add participants to conversations they created"
  on public.conversation_participants for insert
  to authenticated
  with check (true);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Participants can view messages"
  on public.messages for select
  to authenticated
  using (
    conversation_id in (select conversation_id from public.conversation_participants where user_id = auth.uid())
  );

create policy "Participants can send messages"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and conversation_id in (select conversation_id from public.conversation_participants where user_id = auth.uid())
  );

alter publication supabase_realtime add table public.messages;

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
create index if not exists participants_user_idx on public.conversation_participants (user_id);
