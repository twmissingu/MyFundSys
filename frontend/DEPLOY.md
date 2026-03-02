# 基金系统前端 - 部署文档

## 项目概述

基金系统前端是一个基于 React + IndexedDB 的纯前端应用，与现有的 Python CLI 系统并存，提供可视化的基金投资管理界面。

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **数据存储**: IndexedDB (Dexie.js)
- **UI组件**: Ant Design Mobile
- **图表**: Recharts
- **日期处理**: Day.js

## 项目结构

```
frontend/
├── dist/                 # 构建输出（可直接部署）
│   └── index.html        # 独立HTML版本（CDN依赖）
├── src/                  # 源代码
│   ├── components/       # 公共组件
│   ├── pages/            # 页面
│   │   ├── Layout.tsx    # 布局框架
│   │   ├── Dashboard.tsx # 首页/仪表盘
│   │   ├── FundList.tsx  # 基金列表
│   │   ├── Holdings.tsx  # 持仓页面
│   │   ├── Transactions.tsx # 交易记录
│   │   └── Reports.tsx   # 报告页面
│   ├── hooks/            # 自定义Hooks
│   │   └── useDB.ts      # 数据库操作
│   ├── db/               # 数据库
│   │   └── index.ts      # IndexedDB配置、95只基金数据
│   ├── types/            # 类型定义
│   │   └── index.ts
│   ├── utils/            # 工具函数
│   │   └── index.ts
│   ├── main.tsx          # 入口文件
│   └── index.css         # 全局样式
├── index.html            # HTML模板
├── package.json          # 依赖配置
├── tsconfig.json         # TypeScript配置
├── vite.config.ts        # Vite配置
└── README.md             # 项目说明
```

## 快速部署

### 方式一：直接打开HTML文件（最简单）

```bash
# 直接使用 dist/index.html
cd /root/.openclaw/workspace/projects/fund-system/frontend/dist
# 用浏览器打开 index.html 即可
```

特点：
- 无需构建
- 依赖CDN加载
- 适合快速体验

### 方式二：本地开发服务器

```bash
cd /root/.openclaw/workspace/projects/fund-system/frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
# 访问 http://localhost:3000
```

### 方式三：构建后部署

```bash
cd /root/.openclaw/workspace/projects/fund-system/frontend

# 安装依赖
npm install

# 构建（注意：当前环境可能内存不足）
npm run build

# 构建输出在 dist/ 目录
# 可将 dist/ 内容部署到任何静态服务器
```

## 功能特性

### 1. 首页/仪表盘
- 资产总览卡片
- 累计收益、收益率统计
- 持仓概览列表
- 今日收益（模拟）

### 2. 基金列表
- 95只ETF基金数据
- 分类筛选（A股宽基、A股行业、港股、美股、商品、债券）
- 搜索功能

### 3. 持仓页面
- 持仓汇总统计
- 详细持仓列表
- 每只基金的份额、成本、市值、收益率
- 持仓占比计算

### 4. 交易记录
- 买入/卖出交易记录
- 添加交易（自动更新持仓）
- 删除交易
- 交易类型标识

### 5. 报告页面
- 资产配置饼图
- 持仓分布柱状图
- 收益曲线（模拟）
- 数据导入/导出（JSON格式）

## 数据存储

使用浏览器 IndexedDB 本地存储：

- **funds**: 基金基础信息（95只预置基金）
- **holdings**: 持仓数据（通过交易自动计算）
- **transactions**: 交易记录

数据完全存储在本地，不会上传到服务器。

## 预置基金数据

系统预置95只ETF基金，涵盖：

| 分类 | 数量 | 示例 |
|------|------|------|
| A股宽基 | 15+ | 沪深300ETF、中证500ETF、创业板ETF |
| A股行业 | 50+ | 医药ETF、半导体ETF、新能源ETF |
| 港股 | 5 | 恒生ETF、中概互联ETF |
| 美股 | 4 | 纳指ETF、标普500ETF |
| 商品 | 3 | 黄金ETF、豆粕ETF |
| 债券 | 3 | 国债ETF、城投债ETF |

## 数据导入导出

支持JSON格式导入导出，与CLI系统数据互通：

```json
{
  "funds": [...],
  "holdings": [...],
  "transactions": [...],
  "exportDate": "2024-01-01T00:00:00.000Z"
}
```

## 浏览器支持

- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

需要支持 IndexedDB 的现代浏览器。

## 界面设计

- 参考且慢APP风格
- E大风格蓝色系配色 (#1677ff)
- 响应式设计，支持手机/平板/桌面
- 卡片式布局，简洁清晰

## 注意事项

1. **首次使用**: 打开页面后会自动初始化95只基金数据
2. **数据备份**: 建议定期导出数据备份
3. **多设备同步**: 可通过导出/导入功能在设备间同步数据
4. **隐私安全**: 所有数据存储在本地浏览器中

## 与CLI系统集成

前端系统与Python CLI系统数据格式兼容：
- CLI系统的SQLite数据可导出为JSON导入前端
- 前端数据可导出为JSON供CLI系统使用

## 开发计划

- [x] 基础框架搭建
- [x] IndexedDB数据库
- [x] 95只基金数据
- [x] 首页仪表盘
- [x] 基金列表页
- [x] 持仓页面
- [x] 交易记录页
- [x] 报告图表页
- [x] 数据导入导出
- [ ] 实时净值更新（需接入API）
- [ ] 定投计划
- [ ] 收益提醒

## License

MIT
