# MyFundSys - 智能基金投资管理系统

[![Deploy to GitHub Pages](https://github.com/twmissingu/MyFundSys/actions/workflows/deploy.yml/badge.svg)](https://github.com/twmissingu/MyFundSys/actions/workflows/deploy.yml)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 基于 E大（ETF拯救世界）投资理念的专业基金投资管理工具

## 🌐 在线访问

**GitHub Pages**: https://twmissingu.github.io/MyFundSys

## 📋 功能特性

### 1. 基金数据管理
- 📊 **95只ETF基金** - 涵盖A股宽基、行业、港股、美股、商品、债券
- 🔍 **基金搜索** - 支持按名称、代码、分类筛选
- 💰 **实时净值** - 对接基金数据API获取最新净值

### 2. 持仓管理
- 💼 **持仓跟踪** - 实时计算持仓市值和盈亏
- 📝 **交易记录** - 完整的买入/卖出记录
- 📈 **收益分析** - 持仓收益、盈亏比例一目了然

### 3. E大文章库
- 📚 **投资理念** - E大经典文章归档
- 🔖 **标签分类** - 按主题、来源分类
- 🔍 **全文搜索** - 快速查找相关内容

### 4. 投资策略
- 🎯 **估值策略** - 基于PE/PB百分位的买卖策略
- 📅 **定投策略** - 定期定额投资计划
- 🔄 **网格策略** - 震荡市低买高卖
- 📊 **策略回测** - 历史数据验证策略效果

### 5. 数据管理
- 💾 **本地存储** - 使用IndexedDB本地存储数据
- 📤 **数据导出** - 备份数据为JSON文件
- 📥 **数据导入** - 从JSON文件恢复数据

## 🚀 快速开始

### 在线使用
直接访问 [GitHub Pages](https://twmissingu.github.io/MyFundSys) 即可使用。

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/twmissingu/MyFundSys.git
cd MyFundSys/frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 📱 界面预览

### 首页仪表盘
- 市场估值状态（钻石坑/合理/危险）
- 资产总览
- 快捷功能入口
- 持仓概览

### 基金列表
- 分类筛选（A股宽基、行业、港股、美股等）
- 实时净值显示
- 涨跌幅展示

### 持仓管理
- 持仓明细
- 盈亏计算
- 添加交易记录

### 交易记录
- 按日期分组
- 买入/卖出筛选
- 删除记录

### E大文章
- 多来源文章（公众号、雪球、微博、且慢）
- 标签分类
- 全文搜索

### 投资策略
- 策略列表
- 策略详情
- 历史回测

## 🏗️ 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI组件**: Ant Design Mobile
- **数据存储**: IndexedDB (Dexie.js)
- **图表**: Recharts
- **部署**: GitHub Pages

## 📁 项目结构

```
MyFundSys/
├── frontend/               # 前端项目
│   ├── src/
│   │   ├── components/    # 公共组件
│   │   ├── pages/         # 页面组件
│   │   │   ├── Dashboard.tsx    # 首页仪表盘
│   │   │   ├── FundList.tsx     # 基金列表
│   │   │   ├── Holdings.tsx     # 持仓管理
│   │   │   ├── Transactions.tsx # 交易记录
│   │   │   ├── Articles.tsx     # E大文章
│   │   │   ├── Strategy.tsx     # 投资策略
│   │   │   └── Settings.tsx     # 设置
│   │   ├── hooks/         # 自定义Hooks
│   │   ├── db/            # 数据库配置
│   │   ├── services/      # API服务
│   │   ├── utils/         # 工具函数
│   │   └── types/         # 类型定义
│   ├── public/            # 静态资源
│   └── package.json
├── data/                  # 数据文件
│   └── articles/          # E大文章
├── .github/workflows/     # CI/CD配置
└── README.md
```

## 💡 使用指南

### 1. 添加持仓
1. 进入"持仓"页面
2. 点击"添加交易"
3. 输入基金代码、交易类型、金额、价格
4. 系统自动计算份额并更新持仓

### 2. 查看E大文章
1. 进入"文章"页面
2. 可按来源筛选（公众号、雪球、微博、且慢）
3. 支持搜索标题、内容、标签
4. 点击文章查看详情

### 3. 运行策略回测
1. 进入"策略"页面
2. 选择策略（估值策略/定投策略/网格策略）
3. 点击"运行回测"
4. 设置回测参数（基金代码、时间区间、初始资金）
5. 查看回测结果

### 4. 数据备份
1. 进入"设置"页面
2. 点击"导出数据"下载JSON备份文件
3. 需要恢复时点击"导入数据"选择备份文件

## 🎯 E大投资理念

> "估值不会告诉你明天涨还是跌，但它会告诉你哪里安全，哪里危险。"
> —— ETF拯救世界

### 核心原则
1. **概率思维** - 追求长期胜率，而非单次正确
2. **估值为锚** - 低估值买入，高估值卖出
3. **仓位管理** - 活着最重要，永远不满仓
4. **资产配置** - 分散投资，降低相关性
5. **逆向投资** - 别人恐惧我贪婪，别人贪婪我恐惧

### 估值体系
| 指标 | 钻石坑 | 合理 | 死亡之顶 |
|------|--------|------|----------|
| 全市场PE | < 25 | ~40 | > 60 |
| 全市场PB | < 2 | ~3 | > 6 |
| 历史百分位 | 0-20% | 40-60% | 80-100% |

### 仓位管理
```
目标仓位 = 100% - 当前估值百分位
```

## 🔧 开发计划

- [x] 基础框架搭建
- [x] IndexedDB数据库
- [x] 95只基金数据
- [x] 持仓管理
- [x] 交易记录
- [x] E大文章库
- [x] 投资策略
- [x] 策略回测
- [x] 数据导入导出
- [x] GitHub Pages部署
- [ ] 实时净值更新（需后端API）
- [ ] 定投计划提醒
- [ ] 收益曲线图表
- [ ] 多语言支持

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

## 🙏 致谢

- [ETF拯救世界](https://xueqiu.com/4771730473) - 投资理念启发
- [且慢](https://qieman.com/) - 长赢指数投资
- [天天基金](https://fund.eastmoney.com/) - 基金数据来源

---

**免责声明**：本系统仅供学习交流，不构成投资建议。投资有风险，入市需谨慎。
