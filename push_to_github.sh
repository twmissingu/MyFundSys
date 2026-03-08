#!/bin/bash

set -e

echo "=========================================="
echo "  推送到 GitHub"
echo "=========================================="
echo ""

cd /Users/ztw/Documents/dev/MyFundSys

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 检查远程仓库
echo -e "${YELLOW}远程仓库配置:${NC}"
git remote -v
echo ""

# 检查 SSH 连接
echo -e "${YELLOW}测试 SSH 连接...${NC}"
if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    echo -e "${GREEN}✓ SSH 连接正常${NC}"
else
    echo -e "${RED}✗ SSH 连接测试失败，但继续尝试推送...${NC}"
fi
echo ""

# 查看提交信息
echo -e "${YELLOW}准备推送的提交:${NC}"
git log --oneline -1
echo ""

# 推送
echo -e "${YELLOW}正在推送到 GitHub...${NC}"
git push origin main

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  ✅ 推送成功！${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "GitHub 仓库: https://github.com/twmissingu/MyFundSys"
echo "GitHub Pages: https://twmissingu.github.io/MyFundSys"
echo ""

