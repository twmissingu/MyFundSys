#!/bin/bash

cd /Users/ztw/Documents/dev/MyFundSys/frontend

echo "检查 vite.config.ts 中的代理配置..."
grep -A 5 "api/suggest" vite.config.ts

echo ""
echo ""
echo "创建一个测试脚本来验证代理..."

cat > /tmp/test_proxy.js << 'TESTEOF'
// 在浏览器控制台运行这个测试
async function testProxy() {
  console.log('测试代理...');
  try {
    const response = await fetch('/api/suggest/get?input=510300&type=14&count=10');
    console.log('状态码:', response.status);
    if (response.ok) {
      const data = await response.json();
      console.log('成功! 数据:', data);
    } else {
      console.error('失败:', response.statusText);
    }
  } catch (e) {
    console.error('错误:', e);
  }
}
testProxy();
TESTEOF

echo ""
echo "请在浏览器开发者工具控制台运行以下代码:"
cat /tmp/test_proxy.js

echo ""
echo ""
echo "或者重启 Vite 服务器并查看代理日志:"
echo "  npm run dev"

