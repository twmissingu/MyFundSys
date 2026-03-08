#!/bin/bash

cd /Users/ztw/Documents/dev/MyFundSys

echo "检查关键文件..."
echo ""

echo "1. AuthPage.tsx (应该只有密码输入，没有邮箱注册):"
grep -c "email" frontend/src/pages/AuthPage.tsx && echo "  ❌ 包含 email 关键字" || echo "  ✅ 不包含 email 关键字"
grep -c "888" frontend/src/pages/AuthPage.tsx && echo "  ✅ 包含密码 888" || echo "  ❌ 不包含密码 888"
echo ""

echo "2. Layout.tsx (应该使用 useSync):"
grep -c "useSync" frontend/src/pages/Layout.tsx && echo "  ✅ 使用 useSync" || echo "  ❌ 未使用 useSync"
grep -c "useSupabase" frontend/src/pages/Layout.tsx && echo "  ❌ 还在使用 useSupabase" || echo "  ✅ 未使用 useSupabase"
echo ""

echo "3. 检查是否有未提交的修改:"
git status --short
echo ""

echo "4. 最近的提交记录:"
git log --oneline -5
echo ""

echo "5. GitHub Actions 文件:"
head -20 .github/workflows/deploy.yml

