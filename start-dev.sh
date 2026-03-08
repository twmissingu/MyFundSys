#!/bin/bash
# ============================================
# MyFundSys 开发环境启动脚本
# ============================================

echo "========================================"
echo "  MyFundSys 开发环境启动"
echo "========================================"

# 查找 node 路径
NODE_PATH="/usr/local/Cellar/node@20/20.19.2/bin/node"
if [ ! -f "$NODE_PATH" ]; then
    NODE_PATH=$(which node)
fi

if [ -z "$NODE_PATH" ]; then
    echo "❌ 错误: 未找到 Node.js"
    exit 1
fi

echo "✅ Node.js: $NODE_PATH"
echo ""

# 检查代理服务器是否已在运行
PROXY_PID=$(pgrep -f "proxy-simple.js" | head -1)

if [ -n "$PROXY_PID" ]; then
    echo "✅ CORS代理服务器已在运行 (PID: $PROXY_PID)"
else
    echo "🚀 启动 CORS代理服务器..."
    nohup "$NODE_PATH" "$(dirname "$0")/proxy-simple.js" > /tmp/proxy.log 2>&1 &
    sleep 2
    
    # 验证启动
    if curl -s "http://localhost:3001/" > /dev/null; then
        echo "✅ CORS代理服务器启动成功"
    else
        echo "❌ CORS代理服务器启动失败，查看日志: tail -f /tmp/proxy.log"
    fi
fi

echo ""
echo "代理状态: http://localhost:3001/"
echo ""

# 进入前端目录并启动
cd "$(dirname "$0")/frontend"

echo "🚀 启动前端开发服务器..."
echo ""
npm run dev
