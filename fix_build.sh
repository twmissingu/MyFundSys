#!/bin/bash

cd /Users/ztw/Documents/dev/MyFundSys

echo "修复 feishuService.ts 语法错误..."
git add frontend/src/services/feishuService.ts
git commit -m "fix: 修复 feishuService.ts 注释语法错误"
git push origin main

echo ""
echo "✅ 已推送修复"
echo "查看部署: https://github.com/twmissingu/MyFundSys/actions"

