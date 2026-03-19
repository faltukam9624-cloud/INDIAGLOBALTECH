-- Run this in Supabase SQL Editor

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  plan text default 'free' check (plan in ('free','pro','business')),
  usage_today integer default 0,
  usage_total integer default 0,
  last_used_date text,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_updated_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  tool text,
  plan text,
  created_at timestamptz default now()
);

-- Allow users to read their own profile
alter table profiles enable row level security;
create policy "Users read own profile" on profiles for select using (auth.uid() = id);
create policy "Service role full access" on profiles using (true) with check (true);

alter table usage_logs enable row level security;
create policy "Service role full access logs" on usage_logs using (true) with check (true);
