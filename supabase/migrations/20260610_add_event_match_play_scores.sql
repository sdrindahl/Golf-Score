create table if not exists public.event_match_play_scores (
  id text primary key,
  event_id text not null unique references public.events(id) on delete cascade,
  team_one_id text not null references public.event_teams(id) on delete cascade,
  team_two_id text not null references public.event_teams(id) on delete cascade,
  hole_results text[] not null default '{}',
  in_progress boolean not null default true,
  winning_team_id text references public.event_teams(id) on delete set null,
  closing_hole integer,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  last_activity_at timestamptz not null default timezone('utc'::text, now()),
  check (team_one_id <> team_two_id),
  check (closing_hole is null or closing_hole >= 1)
);

alter table public.event_match_play_scores enable row level security;

revoke all on public.event_match_play_scores from anon, authenticated;

create index if not exists event_match_play_scores_event_id_idx on public.event_match_play_scores (event_id);
create index if not exists event_match_play_scores_team_one_id_idx on public.event_match_play_scores (team_one_id);
create index if not exists event_match_play_scores_team_two_id_idx on public.event_match_play_scores (team_two_id);

create or replace function public.update_event_match_play_scores_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists event_match_play_scores_set_updated_at on public.event_match_play_scores;
create trigger event_match_play_scores_set_updated_at
before update on public.event_match_play_scores
for each row
execute function public.update_event_match_play_scores_updated_at();