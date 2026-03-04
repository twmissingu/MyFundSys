# MyFundSys Supabase 部署说明

## 1. Supabase 项目配置

### 1.1 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com) 并注册/登录
2. 点击 "New Project" 创建新项目
3. 填写项目名称: `myfundsys`
4. 设置数据库密码（请妥善保存）
5. 选择地区: `East Asia (Singapore)` 或最近的地区
6. 选择免费套餐 (Free Tier)
7. 等待项目创建完成（约1-2分钟）

### 1.2 获取项目凭证

项目创建完成后：

1. 进入 Project Settings → API
2. 复制以下信息：
   - **Project URL**: `https://<project-ref>.supabase.co`
   - **anon public API key**: `eyJhbG...`

### 1.3 配置身份验证

进入 Authentication → Settings：

1. **Site URL**: 设置为生产环境域名
   - 开发环境: `http://localhost:5173`
   - 生产环境: `https://twmissingu.github.io/MyFundSys`

2. **Redirect URLs**: 添加回调地址
   - `http://localhost:5173/*`
   - `https://twmissingu.github.io/MyFundSys/*`

3. **Email Auth**: 确保已启用
   - Confirm email: 可选（建议生产环境启用）

## 2. 数据库初始化

### 2.1 执行 SQL 迁移

在 Supabase Dashboard 中：

1. 进入 SQL Editor
2. 新建查询
3. 复制并执行 `supabase/migrations/001_initial_schema.sql`
4. 复制并执行 `supabase/migrations/002_seed_data.sql`

### 2.2 验证数据

执行以下查询验证数据：

```sql
-- 检查基金数据
select count(*) from funds;
-- 应返回 95

-- 检查策略数据
select count(*) from strategies;
-- 应返回 3
```

## 3. 前端环境配置

### 3.1 本地开发

1. 复制环境变量文件：
```bash
cd frontend
cp .env.example .env
```

2. 编辑 `.env` 文件，填入 Supabase 凭证：
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

3. 安装依赖：
```bash
npm install
```

4. 启动开发服务器：
```bash
npm run dev
```

### 3.2 生产部署

#### GitHub Pages 部署

1. 在 GitHub 仓库设置中添加 Secrets：
   - 进入 Settings → Secrets and variables → Actions
   - 添加 `VITE_SUPABASE_URL`
   - 添加 `VITE_SUPABASE_ANON_KEY`

2. 更新 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: cd frontend && npm ci
        
      - name: Build
        run: cd frontend && npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./frontend/dist
```

3. 推送代码触发部署：
```bash
git add .
git commit -m "feat: migrate to Supabase with real-time sync"
git push origin main
```

## 4. 实时订阅配置

实时订阅已自动配置，无需额外操作。

### 4.1 验证实时功能

1. 在两个不同浏览器窗口登录同一账号
2. 在窗口A添加交易记录
3. 观察窗口B是否自动更新持仓数据

### 4.2 实时订阅原理

- 使用 Supabase Realtime 功能
- 监听 `holdings` 和 `transactions` 表的变化
- 支持 INSERT、UPDATE、DELETE 事件
- 自动清理订阅，避免内存泄漏

## 5. 安全注意事项

### 5.1 RLS (Row Level Security)

已配置的 RLS 策略：
- `funds` 表: 所有人可读
- `holdings` 表: 仅用户自己可读写
- `transactions` 表: 仅用户自己可读写
- `strategies` 表: 所有人可读

### 5.2 环境变量保护

- **永远不要**将 `.env` 文件提交到 Git
- **永远不要**在客户端代码中暴露 `service_role` key
- 仅使用 `anon` key 进行客户端身份验证

### 5.3 生产环境检查清单

- [ ] 已启用邮箱确认（可选）
- [ ] 已配置正确的 Site URL 和 Redirect URLs
- [ ] 已设置 GitHub Secrets
- [ ] 已验证 RLS 策略正常工作
- [ ] 已测试实时同步功能

## 6. 故障排查

### 6.1 无法登录

1. 检查 Site URL 配置是否正确
2. 检查邮箱/密码是否正确
3. 查看浏览器控制台错误信息

### 6.2 数据不同步

1. 检查网络连接
2. 查看 Supabase Realtime 日志
3. 确认用户已登录

### 6.3 权限错误

1. 检查 RLS 策略是否正确配置
2. 确认用户已登录
3. 查看浏览器网络请求

## 7. 数据迁移

如需将现有 IndexedDB 数据迁移到 Supabase：

1. 在原系统中导出数据（设置 → 导出数据）
2. 登录新系统
3. 导入数据（设置 → 导入数据）
4. 数据将自动关联到当前登录用户

## 8. 备份策略

### 8.1 自动备份

Supabase 提供每日自动备份（免费套餐保留7天）

### 8.2 手动备份

1. 在 Supabase Dashboard 中进入 Database → Backups
2. 点击 "Create Backup"

### 8.3 导出数据

定期使用前端导出功能备份数据到本地
