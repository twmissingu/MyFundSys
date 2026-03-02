# 基金系统前端

基于 React + TypeScript + Vite + IndexedDB 的纯前端基金管理系统。

## 功能特性

- 📊 **仪表盘** - 资产总览、今日收益、累计收益
- 📈 **基金列表** - 95只ETF基金、分类筛选、搜索
- 💼 **持仓管理** - 实时持仓计算、收益分析
- 📝 **交易记录** - 买入/卖出记录、增删改查
- 📉 **报告图表** - 资产配置、收益曲线、持仓分布
- 💾 **数据导入导出** - JSON格式，与CLI数据兼容

## 技术栈

- React 18 + TypeScript
- Vite 构建工具
- IndexedDB (Dexie.js) - 本地数据存储
- Ant Design Mobile - 移动端UI组件
- Recharts - 图表库

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 预览构建结果
npm run preview
```

## 项目结构

```
src/
├── components/     # 公共组件
├── pages/          # 页面
│   ├── Layout.tsx      # 布局框架
│   ├── Dashboard.tsx   # 首页/仪表盘
│   ├── FundList.tsx    # 基金列表
│   ├── Holdings.tsx    # 持仓页面
│   ├── Transactions.tsx # 交易记录
│   └── Reports.tsx     # 报告页面
├── hooks/          # 自定义Hooks
│   └── useDB.ts    # 数据库操作
├── db/             # 数据库
│   └── index.ts    # IndexedDB配置、95只基金数据
├── types/          # 类型定义
│   └── index.ts
├── utils/          # 工具函数
│   └── index.ts
├── main.tsx        # 入口文件
└── index.css       # 全局样式
```

## 预置基金数据

系统预置95只ETF基金，涵盖：
- A股宽基指数（沪深300、中证500、创业板等）
- A股行业（医药、科技、消费、金融等）
- 港股（恒生、中概互联等）
- 美股（纳指、标普500等）
- 商品（黄金、豆粕等）
- 债券

## 数据存储

使用浏览器 IndexedDB 本地存储：
- `funds` - 基金基础信息
- `holdings` - 持仓数据
- `transactions` - 交易记录

## 数据导入导出

支持JSON格式导入导出，可与CLI系统数据互通：
- 导出：生成 `fund-data-YYYY-MM-DD.json` 文件
- 导入：选择JSON文件恢复数据

## 界面设计

- 参考且慢APP风格
- E大风格蓝色系配色
- 响应式设计，支持手机/平板/桌面
- 卡片式布局，简洁清晰

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

## 浏览器支持

- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

## License

MIT
