create table if not exists public.event_teams (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.event_teams enable row level security;

revoke all on public.event_teams from anon, authenticated;

create table if not exists public.event_team_members (
  id bigserial primary key,
  team_id text not null references public.event_teams(id) on delete cascade,
  event_id text not null references public.events(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (team_id, user_id)
);

alter table public.event_team_members enable row level security;

revoke all on public.event_team_members from anon, authenticated;

create index if not exists event_teams_event_id_idx on public.event_teams (event_id);
create index if not exists event_team_members_team_id_idx on public.event_team_members (team_id);
create index if not exists event_team_members_event_id_idx on public.event_team_members (event_id);
create index if not exists event_team_members_user_id_idx on public.event_team_members (user_id);
