#!/bin/bash
echo "=== 检查 Node.js 安装位置 ==="

# 常见安装路径
paths=(
  "/usr/local/bin/node"
  "/usr/local/bin/npm"
  "/opt/homebrew/bin/node"
  "/opt/homebrew/bin/npm"
  "$HOME/.nvm/versions/node/*/bin/node"
  "/Applications/Node.app/Contents/bin/node"
  "/usr/bin/node"
)

for p in "${paths[@]}"; do
  if [ -f "$p" ]; then
    echo "找到: $p"
    "$p" -v 2>/dev/null || echo "  (无法执行)"
  fi
done

echo ""
echo "=== 检查 PATH ==="
echo "$PATH" | tr ':' '\n'

echo ""
echo "=== 搜索 node 命令 ==="
which -a node 2>/dev/null || echo "node 不在 PATH 中"
which -a npm 2>/dev/null || echo "npm 不在 PATH 中"
