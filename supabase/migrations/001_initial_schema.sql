-- Supabase 数据库迁移脚本
-- 执行此脚本创建完整的 MyFundSys 数据库结构

-- ============================================
-- 1. 创建表结构
-- ============================================

-- 基金表 (公共只读)
create table if not exists funds (
  id text primary key,
  code text not null unique,
  name text not null,
  category text not null,
  nav numeric,
  nav_date date,
  pe numeric,
  pb numeric,
  dividend_yield numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 持仓表 (用户私有)
create table if not exists holdings (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  fund_id text references funds(id) not null,
  fund_code text not null,
  fund_name text not null,
  shares numeric not null default 0,
  avg_cost numeric not null default 0,
  total_cost numeric not null default 0,
  current_nav numeric,
  current_value numeric,
  profit numeric,
  profit_rate numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 交易记录表 (用户私有)
create table if not exists transactions (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  fund_id text references funds(id) not null,
  fund_code text not null,
  fund_name text not null,
  type text not null check (type in ('buy', 'sell')),
  date date not null,
  amount numeric not null,
  price numeric not null,
  shares numeric not null,
  fee numeric default 0,
  remark text,
  created_at timestamptz default now()
);

-- 策略表 (公共只读)
create table if not exists strategies (
  id text primary key,
  name text not null,
  description text,
  type text not null,
  rules jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 2. 启用 RLS (Row Level Security)
-- ============================================

alter table funds enable row level security;
alter table holdings enable row level security;
alter table transactions enable row level security;
alter table strategies enable row level security;

-- ============================================
-- 3. RLS 策略配置
-- ============================================

-- funds: 所有人可读
create policy "Funds are viewable by everyone" 
on funds for select using (true);

-- holdings: 用户只能操作自己的数据
create policy "Users can view own holdings" 
on holdings for select using (auth.uid() = user_id);

create policy "Users can insert own holdings" 
on holdings for insert with check (auth.uid() = user_id);

create policy "Users can update own holdings" 
on holdings for update using (auth.uid() = user_id);

create policy "Users can delete own holdings" 
on holdings for delete using (auth.uid() = user_id);

-- transactions: 用户只能操作自己的数据
create policy "Users can view own transactions" 
on transactions for select using (auth.uid() = user_id);

create policy "Users can insert own transactions" 
on transactions for insert with check (auth.uid() = user_id);

create policy "Users can update own transactions" 
on transactions for update using (auth.uid() = user_id);

create policy "Users can delete own transactions" 
on transactions for delete using (auth.uid() = user_id);

-- strategies: 所有人可读
create policy "Strategies are viewable by everyone" 
on strategies for select using (true);

-- ============================================
-- 4. 创建实时订阅
-- ============================================

-- 删除已存在的 publication（如果存在）
drop publication if exists supabase_realtime;

-- 创建新的 publication
create publication supabase_realtime;

-- 将表添加到 publication
alter publication supabase_realtime add table holdings;
alter publication supabase_realtime add table transactions;

-- ============================================
-- 5. 创建更新时间戳触发器
-- ============================================

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language 'plpgsql';

create trigger update_funds_updated_at before update on funds
  for each row execute function update_updated_at_column();

create trigger update_holdings_updated_at before update on holdings
  for each row execute function update_updated_at_column();

create trigger update_strategies_updated_at before update on strategies
  for each row execute function update_updated_at_column();
