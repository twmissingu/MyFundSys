#!/bin/bash

echo "=========================================="
echo "  Homebrew 国内镜像安装（修正版）"
echo "=========================================="
echo ""

# 使用清华镜像安装（最稳定）
echo "使用清华镜像安装 Homebrew..."
echo ""

# 先下载安装脚本到本地，避免网络中断
INSTALL_SCRIPT="/tmp/homebrew_install.sh"

if curl -fsSL -o "$INSTALL_SCRIPT" "https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/install.sh"; then
    echo "✓ 安装脚本下载成功"
else
    echo "✗ 下载失败，尝试使用Gitee镜像..."
    curl -fsSL -o "$INSTALL_SCRIPT" "https://gitee.com/cunkai/HomebrewCN/raw/master/Homebrew.sh"
fi

# 设置镜像环境变量
export HOMEBREW_INSTALL_FROM_API=1
export HOMEBREW_API_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api"
export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles"

# 执行安装
chmod +x "$INSTALL_SCRIPT"
/bin/bash "$INSTALL_SCRIPT"

echo ""
echo "=========================================="
echo "  安装完成！"
echo "=========================================="
echo ""
echo "如果安装成功，请添加环境变量到 ~/.zprofile："
echo ""
echo '# Homebrew 清华镜像配置'
echo 'export HOMEBREW_INSTALL_FROM_API=1'
echo 'export HOMEBREW_API_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api"'
echo 'export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles"'
echo 'export HOMEBREW_CORE_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/homebrew-core.git"'
echo 'export HOMEBREW_BREW_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/brew.git"'
echo 'eval "\$(/opt/homebrew/bin/brew shellenv)"'

