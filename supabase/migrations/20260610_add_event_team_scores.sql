create table if not exists public.event_team_scores (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  team_id text not null references public.event_teams(id) on delete cascade,
  scores integer[] not null default '{}',
  total_score integer not null default 0,
  in_progress boolean not null default true,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  last_activity_at timestamptz not null default timezone('utc'::text, now()),
  unique (team_id)
);

alter table public.event_team_scores enable row level security;

revoke all on public.event_team_scores from anon, authenticated;

create index if not exists event_team_scores_event_id_idx on public.event_team_scores (event_id);
create index if not exists event_team_scores_team_id_idx on public.event_team_scores (team_id);
