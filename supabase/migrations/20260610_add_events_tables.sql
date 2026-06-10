create table if not exists public.events (
  id text primary key,
  name text not null,
  organizer_id text not null references public.users(id) on delete cascade,
  course_id text references public.courses(id) on delete set null,
  course_name text,
  event_date date,
  hole_count integer not null default 18,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  enabled_features text[] not null default '{}',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.events enable row level security;

revoke all on public.events from anon, authenticated;

create table if not exists public.event_members (
  id bigserial primary key,
  event_id text not null references public.events(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  role text not null default 'player' check (role in ('organizer', 'player')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (event_id, user_id)
);

alter table public.event_members enable row level security;

revoke all on public.event_members from anon, authenticated;

alter table public.rounds
  add column if not exists event_id text references public.events(id) on delete set null;

create index if not exists events_organizer_id_idx on public.events (organizer_id);
create index if not exists events_status_idx on public.events (status);
create index if not exists event_members_event_id_idx on public.event_members (event_id);
create index if not exists event_members_user_id_idx on public.event_members (user_id);
create index if not exists rounds_event_id_idx on public.rounds (event_id);

create or replace function public.update_events_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row
execute function public.update_events_updated_at();