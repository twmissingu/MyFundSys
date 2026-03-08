#!/bin/bash

echo "启动 CORS 代理服务器..."
echo ""

# 检查是否安装了依赖
if [ ! -d "proxy-server/node_modules" ]; then
  echo "首次运行，安装依赖..."
  mkdir -p proxy-server
  cd proxy-server
  
  # 创建package.json
  cat > package.json << 'PKGJSON'
{
  "name": "myfundsys-proxy",
  "version": "1.0.0",
  "description": "CORS proxy server for MyFundSys",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "http-proxy-middleware": "^2.0.6"
  }
}
PKGJSON

  # 安装依赖
  npm install
  
  # 复制代理服务器代码
  cp ../proxy-server.js index.js
  
  cd ..
fi

# 启动代理服务器
cd proxy-server
npm start

