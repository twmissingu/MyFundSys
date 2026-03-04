# MyFundSys Supabase 迁移文档

## 1. Supabase 项目配置说明

### 1.1 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com) 并注册/登录
2. 点击 "New Project" 创建新项目
3. 填写项目名称（如：myfundsys）
4. 选择数据库密码（请妥善保存）
5. 选择地区和免费套餐
6. 等待项目创建完成（约1-2分钟）

### 1.2 获取项目凭证

项目创建完成后，进入 Project Settings → API，获取以下信息：

- **Project URL**: `https://<project-ref>.supabase.co`
- **anon public API key**: 用于客户端的身份验证

### 1.3 配置身份验证

进入 Authentication → Settings：

1. **Site URL**: 配置为生产环境域名（如 `https://twmissingu.github.io/MyFundSys`）
2. **Redirect URLs**: 添加回调地址
3. **Email Auth**: 启用邮箱/密码登录（默认已启用）

## 2. 数据库表结构

### 2.1 执行 SQL 迁移脚本

在 Supabase Dashboard 中，进入 SQL Editor，执行以下 SQL：

```sql
-- 启用 RLS (Row Level Security)
alter table if exists funds enable row level security;
alter table if exists holdings enable row level security;
alter table if exists transactions enable row level security;

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

-- RLS 策略

-- funds: 所有人可读
CREATE POLICY "Funds are viewable by everyone" 
ON funds FOR SELECT USING (true);

-- holdings: 用户只能操作自己的数据
CREATE POLICY "Users can view own holdings" 
ON holdings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own holdings" 
ON holdings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own holdings" 
ON holdings FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own holdings" 
ON holdings FOR DELETE USING (auth.uid() = user_id);

-- transactions: 用户只能操作自己的数据
CREATE POLICY "Users can view own transactions" 
ON transactions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" 
ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" 
ON transactions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" 
ON transactions FOR DELETE USING (auth.uid() = user_id);

-- strategies: 所有人可读
CREATE POLICY "Strategies are viewable by everyone" 
ON strategies FOR SELECT USING (true);

-- 创建实时订阅所需的 publication
BEGIN;
  -- 删除已存在的 publication（如果存在）
  DROP PUBLICATION IF EXISTS supabase_realtime;
  -- 创建新的 publication
  CREATE PUBLICATION supabase_realtime;
COMMIT;

-- 将表添加到 publication
ALTER PUBLICATION supabase_realtime ADD TABLE holdings;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- 创建更新时间戳的函数和触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_funds_updated_at BEFORE UPDATE ON funds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_holdings_updated_at BEFORE UPDATE ON holdings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE ON strategies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2.2 初始化基金数据

执行以下 SQL 初始化 95 只 ETF 基金数据：

```sql
-- 插入基金数据（95只ETF）
INSERT INTO funds (id, code, name, category) VALUES
('f001', '510300', '沪深300ETF', 'A股宽基'),
('f002', '510500', '中证500ETF', 'A股宽基'),
('f003', '510050', '上证50ETF', 'A股宽基'),
('f004', '159915', '创业板ETF', 'A股宽基'),
('f005', '159901', '深证100ETF', 'A股宽基'),
('f006', '510880', '红利ETF', 'A股宽基'),
('f007', '512010', '医药ETF', 'A股行业'),
('f008', '512170', '医疗ETF', 'A股行业'),
('f009', '512480', '半导体ETF', 'A股行业'),
('f010', '515030', '新能源车ETF', 'A股行业'),
('f011', '515700', '光伏ETF', 'A股行业'),
('f012', '512660', '军工ETF', 'A股行业'),
('f013', '512000', '券商ETF', 'A股行业'),
('f014', '512800', '银行ETF', 'A股行业'),
('f015', '512200', '地产ETF', 'A股行业'),
('f016', '159928', '消费ETF', 'A股行业'),
('f017', '512690', '酒ETF', 'A股行业'),
('f018', '159995', '芯片ETF', 'A股行业'),
('f019', '515050', '5GETF', 'A股行业'),
('f020', '512980', '传媒ETF', 'A股行业'),
('f021', '510900', 'H股ETF', '港股'),
('f022', '159920', '恒生ETF', '港股'),
('f023', '513050', '中概互联网ETF', '港股'),
('f024', '513130', '恒生科技ETF', '港股'),
('f025', '513180', '恒生医疗ETF', '港股'),
('f026', '513100', '纳指ETF', '美股'),
('f027', '513500', '标普500ETF', '美股'),
('f028', '159941', '纳斯达克ETF', '美股'),
('f029', '513300', '纳斯达克100ETF', '美股'),
('f030', '518880', '黄金ETF', '商品'),
('f031', '159985', '豆粕ETF', '商品'),
('f032', '159981', '能源化工ETF', '商品'),
('f033', '511010', '国债ETF', '债券'),
('f034', '511220', '城投债ETF', '债券'),
('f035', '511260', '十年国债ETF', '债券'),
('f036', '159949', '创业板50ETF', 'A股宽基'),
('f037', '588000', '科创50ETF', 'A股宽基'),
('f038', '512100', '中证1000ETF', 'A股宽基'),
('f039', '159781', '双创50ETF', 'A股宽基'),
('f040', '510180', '上证180ETF', 'A股宽基'),
('f041', '512070', '证券保险ETF', 'A股行业'),
('f042', '515210', '钢铁ETF', 'A股行业'),
('f043', '515220', '煤炭ETF', 'A股行业'),
('f044', '159870', '化工ETF', 'A股行业'),
('f045', '516970', '基建ETF', 'A股行业'),
('f046', '159766', '旅游ETF', 'A股行业'),
('f047', '515250', '智能汽车ETF', 'A股行业'),
('f048', '515400', '人工智能ETF', 'A股行业'),
('f049', '159819', '人工智能ETF', 'A股行业'),
('f050', '516010', '游戏ETF', 'A股行业'),
('f051', '159825', '农业ETF', 'A股行业'),
('f052', '516110', '汽车ETF', 'A股行业'),
('f053', '515650', '消费50ETF', 'A股行业'),
('f054', '159996', '家电ETF', 'A股行业'),
('f055', '512720', '计算机ETF', 'A股行业'),
('f056', '515000', '科技ETF', 'A股行业'),
('f057', '159807', '科技50ETF', 'A股行业'),
('f058', '512580', '环保ETF', 'A股行业'),
('f059', '159611', '电力ETF', 'A股行业'),
('f060', '515880', '通信ETF', 'A股行业'),
('f061', '512330', '信息ETF', 'A股行业'),
('f062', '159939', '信息技术ETF', 'A股行业'),
('f063', '515290', '银行ETF天弘', 'A股行业'),
('f064', '512640', '金融地产ETF', 'A股行业'),
('f065', '512910', '证券ETF', 'A股行业'),
('f066', '159848', '证券ETF基金', 'A股行业'),
('f067', '512190', '沪深300红利ETF', 'A股宽基'),
('f068', '515080', '中证红利ETF', 'A股宽基'),
('f069', '510810', '上海国企ETF', 'A股宽基'),
('f070', '510110', '周期ETF', 'A股行业'),
('f071', '510160', '产业升级ETF', 'A股行业'),
('f072', '510230', '金融ETF', 'A股行业'),
('f073', '510260', '新兴ETF', 'A股行业'),
('f074', '510280', '成长ETF', 'A股行业'),
('f075', '510440', '500沪市ETF', 'A股宽基'),
('f076', '512220', '小盘价值ETF', 'A股宽基'),
('f077', '512240', '景顺500ETF', 'A股宽基'),
('f078', '512400', '有色金属ETF', 'A股行业'),
('f079', '512500', '中证500ETF华夏', 'A股宽基'),
('f080', '512510', 'ETF500', 'A股宽基'),
('f081', '512520', '沪深300ETF华夏', 'A股宽基'),
('f082', '512530', '沪深300ETF博时', 'A股宽基'),
('f083', '512560', '中证军工ETF', 'A股行业'),
('f084', '512590', '高股息ETF', 'A股宽基'),
('f085', '512610', '医药卫生ETF', 'A股行业'),
('f086', '512770', '战略新兴ETF', 'A股行业'),
('f087', '512780', '京津冀ETF', 'A股行业'),
('f088', '512820', '银行ETF鹏华', 'A股行业'),
('f089', '512850', '证券龙头ETF', 'A股行业'),
('f090', '512860', '华安A股ETF', 'A股宽基'),
('f091', '512870', '杭州湾区ETF', 'A股行业'),
('f092', '512880', '证券ETF基金', 'A股行业'),
('f093', '512900', '证券ETF南方', 'A股行业'),
('f094', '512950', '央企ETF', 'A股行业'),
('f095', '159992', '创新药ETF', 'A股行业')
ON CONFLICT (id) DO NOTHING;

-- 插入策略数据
INSERT INTO strategies (id, name, description, type, rules) VALUES
('s001', 'E大估值策略', '基于E大（ETF拯救世界）的估值投资策略，低估值时买入，高估值时卖出', 'valuation', '[
  {"condition": "percentile < 20", "action": "buy", "params": {"ratio": 1.5}},
  {"condition": "percentile < 40", "action": "buy", "params": {"ratio": 1.0}},
  {"condition": "percentile > 80", "action": "sell", "params": {"ratio": 0.5}},
  {"condition": "percentile > 90", "action": "sell", "params": {"ratio": 0.8}}
]'::jsonb),
('s002', '定投策略', '定期定额投资策略，适合长期持有', 'trend', '[
  {"condition": "monthly", "action": "buy", "params": {"amount": 1000}}
]'::jsonb),
('s003', '网格策略', '在价格区间内进行网格交易，低买高卖', 'grid', '[
  {"condition": "price_drop_5%", "action": "buy", "params": {"ratio": 0.2}},
  {"condition": "price_rise_5%", "action": "sell", "params": {"ratio": 0.2}}
]'::jsonb)
ON CONFLICT (id) DO NOTHING;
```

## 3. 前端代码改造

### 3.1 Supabase 客户端配置

创建 `src/lib/supabase.ts`：

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

### 3.2 环境变量配置

创建 `.env.example`：

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3.3 类型定义

创建 `src/types/supabase.ts`：包含完整的数据库类型定义

## 4. 部署说明

### 4.1 本地开发

1. 复制 `.env.example` 为 `.env`
2. 填入 Supabase 项目凭证
3. 运行 `npm run dev`

### 4.2 生产部署

1. 在 GitHub 仓库设置中添加 Secrets：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. 更新 GitHub Actions 工作流以注入环境变量

### 4.3 Supabase 项目设置

1. 在 Authentication → URL Configuration 中设置站点 URL
2. 启用邮箱确认（可选）
3. 配置 SMTP 用于邮件发送（生产环境）

## 5. 实时订阅说明

系统已配置实时订阅，当 holdings 或 transactions 表发生变化时：
- 同一用户的所有设备会实时同步数据
- 支持 INSERT、UPDATE、DELETE 事件的实时推送
- 订阅自动在组件卸载时清理

## 6. 数据迁移

如需将现有 IndexedDB 数据迁移到 Supabase：

1. 使用原系统的导出功能导出数据
2. 登录新系统后，使用导入功能将数据上传到 Supabase
3. 数据将自动关联到当前登录用户
