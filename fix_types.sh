#!/bin/bash

cd /Users/ztw/Documents/dev/MyFundSys/frontend

echo "修复 Settings.tsx..."

# 1. 替换 SyncOutline 为其他图标
sed -i '' 's/SyncOutline/SendOutline/g' src/pages/Settings.tsx

# 2. 修复 Button size 属性
sed -i '' 's/size="small"/size="mini"/g' src/pages/Settings.tsx

# 3. 修复 onClick 类型
sed -i '' 's/onClick={syncStatus.triggerSync}/onClick={() => syncStatus.triggerSync()}/g' src/pages/Settings.tsx
sed -i '' 's/onClick={syncStatus.triggerFullSync}/onClick={() => syncStatus.triggerFullSync()}/g' src/pages/Settings.tsx

echo "修复 syncService.ts..."

# 4. 修复 synced 类型 (boolean -> number)
sed -i '' 's/synced: false/synced: 0/g' src/services/syncService.ts
sed -i '' 's/synced: true/synced: 1/g' src/services/syncService.ts

echo "修复完成！"

