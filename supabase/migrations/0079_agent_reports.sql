-- Agent reports (Admin → Briefings): what Clientele's scheduled AI agents
-- write each run. The Chief of staff (weekly), Marketing & sales (twice a
-- week) and Growth strategist (monthly) each save one row; the Chief of
-- staff reads the others' latest. Server only: no access for signed-in users.
create table if not exists public.agent_reports (
  id uuid primary key default gen_random_uuid(),
  agent text not null check (agent in ('chief_of_staff', 'marketing', 'growth')),
  title text not null check (char_length(title) <= 200),
  body text not null check (char_length(body) <= 60000),
  created_at timestamptz not null default now()
);
create index if not exists agent_reports_agent_idx on public.agent_reports (agent, created_at desc);
alter table public.agent_reports enable row level security;
