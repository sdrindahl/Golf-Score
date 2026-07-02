alter table public.events
  add column if not exists format text check (format in ('scramble', 'best_ball', 'match_play')),
  add column if not exists side_games text[] not null default '{}',
  add column if not exists format_config jsonb,
  add column if not exists betting_config jsonb;

create index if not exists events_format_idx on public.events (format);
