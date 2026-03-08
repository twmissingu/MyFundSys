#!/bin/bash

cd /Users/ztw/Documents/dev/MyFundSys

echo "提交修复..."
git add .github/workflows/deploy.yml
git commit -m "fix: 移除 npm 缓存配置，解决 Actions 错误"
git push origin main

echo ""
echo "✅ 已推送修复，GitHub Actions 将重新运行"
echo "查看进度: https://github.com/twmissingu/MyFundSys/actions"

