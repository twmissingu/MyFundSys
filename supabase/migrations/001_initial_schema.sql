-- 初始数据库 Schema
-- 创建时间: 2024
-- 描述: MyFundSys 核心数据表

-- 删除已存在的表（如果存在）
DROP TABLE IF EXISTS favorite_funds CASCADE;
DROP TABLE IF EXISTS holdings CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;

-- 删除已存在的函数（如果存在）
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- 交易记录表
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fund_code VARCHAR(10) NOT NULL,
    fund_name VARCHAR(100) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('buy', 'sell')),
    shares DECIMAL(15, 4) NOT NULL,
    nav DECIMAL(10, 4) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    fee DECIMAL(10, 2) DEFAULT 0,
    date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 持仓表
CREATE TABLE holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fund_code VARCHAR(10) NOT NULL UNIQUE,
    fund_name VARCHAR(100) NOT NULL,
    shares DECIMAL(15, 4) NOT NULL DEFAULT 0,
    avg_nav DECIMAL(10, 4) NOT NULL DEFAULT 0,
    total_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
    current_nav DECIMAL(10, 4),
    market_value DECIMAL(15, 2),
    profit DECIMAL(15, 2),
    profit_rate DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 基金收藏表
CREATE TABLE favorite_funds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fund_code VARCHAR(10) NOT NULL UNIQUE,
    fund_name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_fund_code ON transactions(fund_code);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_holdings_updated_at
    BEFORE UPDATE ON holdings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 启用行级安全策略 (RLS)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_funds ENABLE ROW LEVEL SECURITY;

-- 创建允许所有访问的策略（单用户模式）
CREATE POLICY "Allow all access" ON transactions
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access" ON holdings
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access" ON favorite_funds
    FOR ALL USING (true) WITH CHECK (true);
