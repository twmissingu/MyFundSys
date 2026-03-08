#!/bin/bash

cd /Users/ztw/Documents/dev/MyFundSys

echo "强制重新部署..."

# 1. 更新 index.html 添加防缓存版本号
DATE=$(date +%s)
sed -i '' "s|<head>|<head>\n  <!-- Build Time: $DATE -->\n  <meta http-equiv=\"Cache-Control\" content=\"no-cache, no-store, must-revalidate\">\n  <meta http-equiv=\"Pragma\" content=\"no-cache\">\n  <meta http-equiv=\"Expires\" content=\"0\">|" frontend/index.html 2>/dev/null || true

# 2. 修改任意文件触发新构建
echo "// Force rebuild at $(date)" >> frontend/src/main.tsx

# 3. 提交并推送
git add -A
git commit -m "force: 强制重新部署，添加防缓存标记

- 添加 Cache-Control 防止浏览器缓存
- 更新构建时间戳
- 强制重新构建"
git push origin main

echo ""
echo "✅ 已推送，等待 GitHub Actions 部署..."
echo ""
echo "⚠️  部署完成后，请务必："
echo "   1. 强制刷新网页 (Cmd+Shift+R 或 Ctrl+F5)"
echo "   2. 或使用无痕模式打开"
echo ""
echo "查看部署: https://github.com/twmissingu/MyFundSys/actions"

