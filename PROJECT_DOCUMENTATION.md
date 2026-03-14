# MyFundSys 项目文档

## 📋 项目概述

MyFundSys 是一个个人基金投资管理系统，帮助用户管理基金持仓、记录交易、分析投资收益，并提供投资知识库（E大文章）。

### 技术栈

- **前端**: React + TypeScript + Vite + Ant Design Mobile
- **后端**: Python Flask (可选，用于代理 API)
- **数据存储**: IndexedDB (本地) + Supabase (云端同步，可选)
- **部署**: GitHub Pages / Vercel

## 🎯 功能需求

### 核心功能

1. **基金持仓管理**
   - 添加/删除/编辑基金持仓
   - 实时查看持仓市值和收益
   - 资产配置分析

2. **交易记录**
   - 记录买入/卖出交易
   - 支持在途交易（T+1确认）
   - 交易历史查询和筛选

3. **基金查询**
   - 基金搜索（代码/名称）
   - 实时净值查询
   - 基金收藏

4. **投资分析**
   - 收益曲线图表
   - 持仓分析
   - 市场估值参考

5. **知识库**
   - E大投资文章
   - 投资策略参考

6. **数据管理**
   - 本地数据存储
   - 云端同步（Supabase）
   - 数据导入/导出

## 📁 项目结构

```
MyFundSys/
├── frontend/                 # 前端项目
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   ├── components/      # 可复用组件
│   │   ├── services/        # API 服务
│   │   ├── hooks/           # 自定义 Hooks
│   │   ├── db/              # 数据库配置
│   │   ├── types/           # TypeScript 类型
│   │   └── utils/           # 工具函数
│   ├── public/              # 静态资源
│   └── package.json
├── api/                     # Python 后端 (可选)
├── backend/                 # Python 核心模块
├── data/articles/           # E大文章数据
└── docs/                    # 文档
```

## 🔧 开发环境配置

### 前端开发

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173/MyFundSys/

### 环境变量

创建 `.env` 文件：

```bash
# 登录密码
VITE_APP_PASSWORD=your_password

# Supabase 配置（可选）
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

## 🧪 测试

```bash
# 运行测试
npm test

# 运行测试覆盖率
npm run test:coverage
```

## 📦 部署

### GitHub Pages

```bash
npm run build
git push origin main
```

### Vercel

```bash
vercel --prod
```

## 📝 代码规范

- 使用 TypeScript 严格模式
- 组件使用函数式组件 + Hooks
- 使用 Ant Design Mobile 组件库
- 遵循 ESLint 配置

## 🔒 安全说明

- 密码存储在本地环境变量
- 敏感数据不提交到 Git
- API 调用使用代理避免 CORS

## 📄 许可证

MIT License
