create table if not exists public.event_team_player_scores (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  team_id text not null references public.event_teams(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  scores integer[] not null default '{}',
  total_score integer not null default 0,
  in_progress boolean not null default true,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  last_activity_at timestamptz not null default timezone('utc'::text, now()),
  unique (event_id, team_id, user_id)
);

alter table public.event_team_player_scores enable row level security;

revoke all on public.event_team_player_scores from anon, authenticated;

create index if not exists event_team_player_scores_event_id_idx on public.event_team_player_scores (event_id);
create index if not exists event_team_player_scores_team_id_idx on public.event_team_player_scores (team_id);
create index if not exists event_team_player_scores_user_id_idx on public.event_team_player_scores (user_id);

create or replace function public.update_event_team_player_scores_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists event_team_player_scores_set_updated_at on public.event_team_player_scores;
create trigger event_team_player_scores_set_updated_at
before update on public.event_team_player_scores
for each row
execute function public.update_event_team_player_scores_updated_at();
