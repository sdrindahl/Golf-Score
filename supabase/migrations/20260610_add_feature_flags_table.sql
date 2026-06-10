create table if not exists public.feature_flags (
  key text primary key,
  name text not null,
  description text,
  enabled boolean not null default false,
  audience text not null default 'off' check (audience in ('off', 'admins', 'users', 'all')),
  enabled_user_ids text[] not null default '{}',
  updated_at timestamptz not null default timezone('utc'::text, now()),
  updated_by text
);

alter table public.feature_flags enable row level security;

revoke all on public.feature_flags from anon, authenticated;

create index if not exists feature_flags_audience_idx on public.feature_flags (audience);

create or replace function public.update_feature_flags_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists feature_flags_set_updated_at on public.feature_flags;
create trigger feature_flags_set_updated_at
before update on public.feature_flags
for each row
execute function public.update_feature_flags_updated_at();

insert into public.feature_flags (key, name, description, enabled, audience)
values
  ('events_core', 'Events', 'Enables the core Events experience and event-scoped leaderboards.', false, 'off'),
  ('events_teams', 'Event Teams', 'Shows team setup and team leaderboard surfaces inside Events.', false, 'off'),
  ('events_games', 'Event Games', 'Shows side game modules such as skins, Nassau, and similar formats.', false, 'off'),
  ('events_public_view', 'Public Event View', 'Allows spectator or shareable read-only event views.', false, 'off'),
  ('events_payouts', 'Event Payouts', 'Enables payout tracking and settlement surfaces for Events.', false, 'off')
on conflict (key) do nothing;