#!/bin/bash

echo "=========================================="
echo "  Zsh 插件安装（国内源）"
echo "=========================================="
echo ""

PLUGIN_DIR="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins"
mkdir -p "$PLUGIN_DIR"

cd /tmp

# 函数：下载并解压 install_plugin() {
  local name=$1
  local github_path=$2
  local target_dir="$PLUGIN_DIR/$name"
  
  echo "安装 $name..."
  rm -rf "$target_dir"
  
  # 尝试多个镜像源
  local urls=(
    "https://ghproxy.com/https://github.com/$github_path/archive/refs/heads/master.zip"
    "https://github.moeyy.xyz/https://github.com/$github_path/archive/refs/heads/master.zip"
    "https://mirror.ghproxy.com/https://github.com/$github_path/archive/refs/heads/master.zip"
    "https://gh.api.99988866.xyz/https://github.com/$github_path/archive/refs/heads/master.zip"
  )
  
  local downloaded=0
  for url in "${urls[@]}"; do
    echo "  尝试: ${url:0:50}..."
    if curl -fsSL --connect-timeout 10 -o "${name}.zip" "$url" 2>/dev/null; then
      if [ -s "${name}.zip" ]; then
        downloaded=1
        echo "  ✓ 下载成功"
        break
      fi
    fi
  done
  
  if [ $downloaded -eq 0 ]; then
    echo "  ✗ 所有镜像都失败了"
    return 1
  fi
  
  # 解压并安装
  unzip -q "${name}.zip" -d "$PLUGIN_DIR" 2>/dev/null
  mv "$PLUGIN_DIR/${github_path#*/}-master" "$target_dir"
  rm -f "${name}.zip"
  
  echo "  ✓ $name 安装完成"
  return 0
}

# 安装 zsh-autosuggestions
echo "步骤1: zsh-autosuggestions（自动补全）"
if install_plugin "zsh-autosuggestions" "zsh-users/zsh-autosuggestions"; then
  AUTO_OK=1
else
  echo "  ⚠ 安装失败，跳过"
fi
echo ""

# 安装 zsh-syntax-highlighting
echo "步骤2: zsh-syntax-highlighting（语法高亮）"
if install_plugin "zsh-syntax-highlighting" "zsh-users/zsh-syntax-highlighting"; then
  SYNTAX_OK=1
else
  echo "  ⚠ 安装失败，跳过"
fi
echo ""

# 启用插件
echo "步骤3: 配置插件..."

# 读取当前插件
if [ -f ~/.zshrc ]; then
  # 备份
  cp ~/.zshrc ~/.zshrc.backup.$(date +%s)
  
  # 检查是否已有 plugins 行
  if grep -q "^plugins=" ~/.zshrc; then
    # 提取当前插件
    current_plugins=$(grep "^plugins=" ~/.zshrc | sed 's/plugins=(//' | sed 's/)//')
    
    # 添加新插件
    new_plugins="git"
    [ $AUTO_OK ] && new_plugins="$new_plugins zsh-autosuggestions"
    [ $SYNTAX_OK ] && new_plugins="$new_plugins zsh-syntax-highlighting"
    
    sed -i '' "s/^plugins=.*/plugins=($new_plugins)/" ~/.zshrc
    echo "  ✓ 插件已启用: $new_plugins"
  else
    # 添加新行
    echo 'plugins=(git zsh-autosuggestions zsh-syntax-highlighting)' >> ~/.zshrc
    echo "  ✓ 插件配置已添加"
  fi
fi

echo ""
echo "=========================================="
echo "  安装完成！"
echo "=========================================="
echo ""

if [ $AUTO_OK ] && [ $SYNTAX_OK ]; then
  echo "✅ 所有插件安装成功"
  echo ""
  echo "执行以下命令生效："
  echo "  source ~/.zshrc"
elif [ $AUTO_OK ] || [ $SYNTAX_OK ]; then
  echo "⚠️ 部分插件安装成功"
  echo ""
  echo "执行以下命令生效："
  echo "  source ~/.zshrc"
  echo ""
  echo "失败的插件可以稍后重试："
  [ -z "$AUTO_OK" ] && echo "  - zsh-autosuggestions"
  [ -z "$SYNTAX_OK" ] && echo "  - zsh-syntax-highlighting"
else
  echo "✗ 所有插件安装失败"
  echo ""
  echo "建议："
  echo "1. 开启代理软件后重试"
  echo "2. 使用手机热点"
  echo "3. 暂时跳过，以后网络好时安装"
  echo ""
  echo "手动安装命令："
  echo "  git clone https://github.com/zsh-users/zsh-autosuggestions \${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions"
  echo "  git clone https://github.com/zsh-users/zsh-syntax-highlighting \${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting"
fi

echo ""

