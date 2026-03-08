#!/bin/bash

echo "=========================================="
echo "  Homebrew 国内镜像安装脚本"
echo "=========================================="
echo ""
echo "请选择镜像源："
echo "1) 中科大镜像 (推荐，速度快)"
echo "2) 清华镜像"
echo "3) 阿里云镜像"
echo "4) 官方源（不推荐，可能失败）"
echo ""

read -p "请输入数字 [1-4]: " choice

case $choice in
  1)
    echo "使用中科大镜像..."
    export HOMEBREW_INSTALL_FROM_API=1
    export HOMEBREW_API_DOMAIN="https://mirrors.ustc.edu.cn/homebrew-bottles/api"
    export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.ustc.edu.cn/homebrew-bottles"
    export HOMEBREW_CORE_GIT_REMOTE="https://mirrors.ustc.edu.cn/homebrew-core.git"
    export HOMEBREW_BREW_GIT_REMOTE="https://mirrors.ustc.edu.cn/brew.git"
    /bin/bash -c "$(curl -fsSL https://mirrors.ustc.edu.cn/brew/install.sh)"
    ;;
  2)
    echo "使用清华镜像..."
    export HOMEBREW_INSTALL_FROM_API=1
    export HOMEBREW_API_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api"
    export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles"
    export HOMEBREW_CORE_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/homebrew-core.git"
    export HOMEBREW_BREW_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/brew.git"
    /bin/bash -c "$(curl -fsSL https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/install/install.sh)"
    ;;
  3)
    echo "使用阿里云镜像..."
    export HOMEBREW_INSTALL_FROM_API=1
    export HOMEBREW_API_DOMAIN="https://mirrors.aliyun.com/homebrew/homebrew-bottles/api"
    export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.aliyun.com/homebrew/homebrew-bottles"
    export HOMEBREW_CORE_GIT_REMOTE="https://mirrors.aliyun.com/homebrew/homebrew-core.git"
    export HOMEBREW_BREW_GIT_REMOTE="https://mirrors.aliyun.com/homebrew/brew.git"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    ;;
  4)
    echo "使用官方源..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    ;;
  *)
    echo "无效选择，默认使用中科大镜像..."
    export HOMEBREW_INSTALL_FROM_API=1
    export HOMEBREW_API_DOMAIN="https://mirrors.ustc.edu.cn/homebrew-bottles/api"
    export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.ustc.edu.cn/homebrew-bottles"
    /bin/bash -c "$(curl -fsSL https://mirrors.ustc.edu.cn/brew/install.sh)"
    ;;
esac

echo ""
echo "安装完成！"
echo ""
echo "添加到环境变量（如未自动添加）："
echo 'echo "eval \"\$(/opt/homebrew/bin/brew shellenv)\"" >> ~/.zprofile'
echo 'eval "\$(/opt/homebrew/bin/brew shellenv)"'

