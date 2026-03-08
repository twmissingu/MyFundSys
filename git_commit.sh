#!/bin/bash

set -e

echo "=========================================="
echo "  MyFundSys Git 提交脚本"
echo "=========================================="
echo ""

cd /Users/ztw/Documents/dev/MyFundSys

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}步骤 1: 查看当前状态${NC}"
git status --short
echo ""

echo -e "${YELLOW}步骤 2: 添加所有修改${NC}"
git add -A
echo "✓ 已添加所有文件"
echo ""

echo -e "${YELLOW}步骤 3: 创建提交${NC}"
git commit -m "feat: 优化为离线优先架构，添加同步和飞书推送功能

主要更新:
- 改为简单密码验证(888)，移除复杂登录
- 实现离线优先架构: IndexedDB + Supabase 双存储
- 添加网络状态检测和自动同步
- 预留定时任务接口(自动抓取净值、生成日报)
- 添加飞书推送配置和测试功能
- 更新设置页面，显示同步状态
- 多端数据自动同步支持

新增文件:
- services/syncService.ts (数据同步)
- services/schedulerService.ts (定时任务)
- services/feishuService.ts (飞书推送)
- hooks/useSync.ts (同步Hooks)
- supabase/migrations/003_remove_auth_simplified.sql

技术栈: React + TypeScript + Vite + Supabase"
echo "✓ 提交创建成功"
echo ""

echo -e "${YELLOW}步骤 4: 推送到 GitHub${NC}"
git push origin main
echo "✓ 推送成功"
echo ""

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  提交完成！${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "GitHub 仓库: https://github.com/twmissingu/MyFundSys"
echo "GitHub Pages: https://twmissingu.github.io/MyFundSys"
echo ""

