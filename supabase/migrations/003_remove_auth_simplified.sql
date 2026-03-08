-- ============================================
-- 迁移脚本: 移除用户认证，改为简单密码模式
-- ============================================

-- 注意: 此脚本将移除用户隔离，所有数据变为共享
-- 请在执行前备份重要数据

-- ============================================
-- 1. 移除 holdings 表的 user_id 字段
-- ============================================

-- 首先删除外键约束
ALTER TABLE holdings DROP CONSTRAINT IF EXISTS holdings_user_id_fkey;

-- 删除 user_id 字段
ALTER TABLE holdings DROP COLUMN IF EXISTS user_id;

-- ============================================
-- 2. 移除 transactions 表的 user_id 字段
-- ============================================

-- 首先删除外键约束
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;

-- 删除 user_id 字段
ALTER TABLE transactions DROP COLUMN IF EXISTS user_id;

-- ============================================
-- 3. 修改 RLS 策略 - 允许匿名访问
-- ============================================

-- 删除旧的 RLS 策略
DROP POLICY IF EXISTS "Users can view own holdings" ON holdings;
DROP POLICY IF EXISTS "Users can insert own holdings" ON holdings;
DROP POLICY IF EXISTS "Users can update own holdings" ON holdings;
DROP POLICY IF EXISTS "Users can delete own holdings" ON holdings;

DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;

-- 创建新的公开访问策略
CREATE POLICY "Allow all operations on holdings" 
ON holdings FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on transactions" 
ON transactions FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 4. 可选：禁用 RLS（如果不使用认证）
-- ============================================

-- 如果你确定不需要任何认证，可以禁用 RLS
-- 保留 RLS 启用但策略为公开，是为了将来可能需要添加限制

-- ALTER TABLE holdings DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. 确认修改
-- ============================================

-- 查看表结构
-- \d holdings
-- \d transactions

-- ============================================
-- 回滚脚本（如需恢复用户认证，请执行以下语句）
-- ============================================
/*
-- 重新添加 user_id 字段
ALTER TABLE holdings ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 删除公开策略
DROP POLICY IF EXISTS "Allow all operations on holdings" ON holdings;
DROP POLICY IF EXISTS "Allow all operations on transactions" ON transactions;

-- 重新创建用户隔离策略
CREATE POLICY "Users can view own holdings" ON holdings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own holdings" ON holdings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own holdings" ON holdings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own holdings" ON holdings FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);
*/
