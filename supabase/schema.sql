create extension if not exists pgcrypto;

create table if not exists public.scan_results (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  title text,
  risk_level text not null check (risk_level in ('Low', 'Medium', 'High', 'Critical')),
  risk_score integer not null check (risk_score >= 0 and risk_score <= 100),
  indicators jsonb not null default '[]'::jsonb,
  summary text,
  explanation text,
  ai_explanation text,
  recommendations jsonb not null default '[]'::jsonb,
  threat_type text,
  threat_category text,
  threat_categories jsonb not null default '[]'::jsonb,
  user_action text default 'Pending review',
  source text default 'extension',
  notes text,
  trusted_status boolean default false,
  has_login_form boolean default false,
  login_form_detected boolean default false,
  tracker_count integer default 0,
  redirect_count integer default 0,
  suspicious_keywords jsonb not null default '[]'::jsonb,
  protocol text,
  hostname text,
  root_domain text,
  domain_length integer default 0,
  subdomain_depth integer default 0,
  favicon_url text,
  page_fingerprint text,
  scanned_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.scan_results add column if not exists threat_category text;
alter table public.scan_results add column if not exists threat_categories jsonb not null default '[]'::jsonb;
alter table public.scan_results add column if not exists trusted_status boolean default false;
alter table public.scan_results add column if not exists login_form_detected boolean default false;
alter table public.scan_results add column if not exists redirect_count integer default 0;
alter table public.scan_results add column if not exists suspicious_keywords jsonb not null default '[]'::jsonb;
alter table public.scan_results add column if not exists protocol text;
alter table public.scan_results add column if not exists hostname text;
alter table public.scan_results add column if not exists root_domain text;
alter table public.scan_results add column if not exists domain_length integer default 0;
alter table public.scan_results add column if not exists subdomain_depth integer default 0;
alter table public.scan_results add column if not exists favicon_url text;
alter table public.scan_results add column if not exists page_fingerprint text;

create table if not exists public.trusted_sites (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  reason text default 'Trusted by user',
  source text default 'extension',
  notes text,
  added_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.scan_feedback (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scan_results(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('false_positive', 'helpful_warning', 'rescan_requested')),
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.scan_actions (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scan_results(id) on delete cascade,
  action_type text not null check (
    action_type in (
      'scanned',
      'safe_notified',
      'suspicious_notified',
      'danger_blocked',
      'warned',
      'left_site',
      'viewed_report',
      'trusted_site',
      'continued_anyway'
    )
  ),
  page_url text,
  source text default 'extension',
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.scan_actions add column if not exists page_url text;

create index if not exists idx_scan_results_scanned_at
  on public.scan_results (scanned_at desc);

create index if not exists idx_scan_results_risk_level
  on public.scan_results (risk_level);

create index if not exists idx_scan_results_threat_type
  on public.scan_results (threat_type);

create index if not exists idx_scan_results_threat_category
  on public.scan_results (threat_category);

create index if not exists idx_scan_results_trusted_status
  on public.scan_results (trusted_status);

create index if not exists idx_scan_actions_scan_id
  on public.scan_actions (scan_id, created_at desc);

create index if not exists idx_scan_feedback_scan_id
  on public.scan_feedback (scan_id, created_at desc);

create index if not exists idx_trusted_sites_domain
  on public.trusted_sites (domain);

alter table public.scan_results enable row level security;
alter table public.trusted_sites enable row level security;
alter table public.scan_feedback enable row level security;
alter table public.scan_actions enable row level security;

drop policy if exists "demo_select_scan_results" on public.scan_results;
create policy "demo_select_scan_results"
  on public.scan_results
  for select
  to anon, authenticated
  using (true);

drop policy if exists "demo_insert_scan_results" on public.scan_results;
create policy "demo_insert_scan_results"
  on public.scan_results
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "demo_update_scan_results" on public.scan_results;
create policy "demo_update_scan_results"
  on public.scan_results
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "trusted_sites_select" on public.trusted_sites;
create policy "trusted_sites_select"
  on public.trusted_sites
  for select
  to anon, authenticated
  using (true);

drop policy if exists "trusted_sites_insert" on public.trusted_sites;
create policy "trusted_sites_insert"
  on public.trusted_sites
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "scan_feedback_select" on public.scan_feedback;
create policy "scan_feedback_select"
  on public.scan_feedback
  for select
  to anon, authenticated
  using (true);

drop policy if exists "scan_feedback_insert" on public.scan_feedback;
create policy "scan_feedback_insert"
  on public.scan_feedback
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "scan_actions_select" on public.scan_actions;
create policy "scan_actions_select"
  on public.scan_actions
  for select
  to anon, authenticated
  using (true);

drop policy if exists "scan_actions_insert" on public.scan_actions;
create policy "scan_actions_insert"
  on public.scan_actions
  for insert
  to anon, authenticated
  with check (true);
