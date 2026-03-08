#!/bin/bash

set -e

echo "=========================================="
echo "  修复 GitHub Pages 部署"
echo "=========================================="
echo ""

cd /Users/ztw/Documents/dev/MyFundSys

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}步骤 1: 添加修改的部署配置${NC}"
git add .github/workflows/deploy.yml
echo "✓ 已添加"
echo ""

echo -e "${YELLOW}步骤 2: 创建修复提交${NC}"
git commit -m "fix: 更新 GitHub Actions 部署配置

- 添加 fetch-depth: 0 确保获取完整代码
- 清理 npm 缓存避免构建旧版本
- 添加构建输出验证
- 为 Supabase 环境变量添加默认值"
echo "✓ 提交已创建"
echo ""

echo -e "${YELLOW}步骤 3: 推送到 GitHub${NC}"
git push origin main
echo "✓ 推送成功"
echo ""

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  ✅ 修复提交已推送！${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "GitHub Actions 将自动重新部署。"
echo "请等待 2-3 分钟后刷新网页。"
echo ""
echo "查看部署进度:"
echo "  https://github.com/twmissingu/MyFundSys/actions"
echo ""

