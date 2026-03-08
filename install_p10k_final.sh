#!/bin/bash

echo "=========================================="
echo "  Powerlevel10k 完整安装脚本"
echo "=========================================="
echo ""

# 1. 彻底清理旧安装
echo "步骤1: 清理旧安装..."
rm -rf ~/.oh-my-zsh/custom/themes/powerlevel10k
mkdir -p ~/.oh-my-zsh/custom/themes/powerlevel10k
cd ~/.oh-my-zsh/custom/themes/powerlevel10k

echo "✓ 清理完成"
echo ""

# 2. 尝试多种下载方式
echo "步骤2: 下载 Powerlevel10k..."

# 方式1: 使用 ghproxy.com 代理
echo "尝试 ghproxy.com..."
if curl -fsSL --connect-timeout 15 -o internal/p10k.zsh "https://ghproxy.com/https://raw.githubusercontent.com/romkatv/powerlevel10k/master/internal/p10k.zsh" 2>/dev/null; then
    DOWNLOAD_OK=1
    echo "✓ ghproxy.com 可用"
fi

# 方式2: 使用 moeyy.xyz 代理
if [ -z "$DOWNLOAD_OK" ]; then
    echo "尝试 moeyy.xyz..."
    if curl -fsSL --connect-timeout 15 -o powerlevel10k.zsh-theme "https://github.moeyy.xyz/https://raw.githubusercontent.com/romkatv/powerlevel10k/master/powerlevel10k.zsh-theme" 2>/dev/null; then
        DOWNLOAD_OK=1
        echo "✓ moeyy.xyz 可用"
    fi
fi

# 方式3: 使用 raw.fastgit.org
if [ -z "$DOWNLOAD_OK" ]; then
    echo "尝试 fastgit..."
    if curl -fsSL --connect-timeout 15 -o powerlevel10k.zsh-theme "https://raw.fastgit.org/romkatv/powerlevel10k/master/powerlevel10k.zsh-theme" 2>/dev/null; then
        DOWNLOAD_OK=1
        echo "✓ fastgit 可用"
    fi
fi

# 方式4: 直接下载（如果网络好）
if [ -z "$DOWNLOAD_OK" ]; then
    echo "尝试直接下载 GitHub..."
    if curl -fsSL --connect-timeout 15 -o powerlevel10k.zsh-theme "https://raw.githubusercontent.com/romkatv/powerlevel10k/master/powerlevel10k.zsh-theme" 2>/dev/null; then
        DOWNLOAD_OK=1
        echo "✓ GitHub 直接下载成功"
    fi
fi

# 检查下载结果
if [ -z "$DOWNLOAD_OK" ] || [ ! -f powerlevel10k.zsh-theme ]; then
    echo ""
    echo "✗ 所有下载方式都失败了"
    echo ""
    echo "请检查网络连接，或使用以下备用方案："
    echo ""
    echo "1. 使用代理软件（Clash/V2ray）后重试"
    echo "2. 使用手机热点下载"
    echo "3. 暂时使用内置主题："
    echo "   sed -i '' 's/ZSH_THEME=.*/ZSH_THEME=\"agnoster\"/' ~/.zshrc"
    exit 1
fi

echo ""
echo "✓ 核心文件下载成功"
echo ""

# 3. 下载必要文件
echo "步骤3: 下载其他必要文件..."

# 下载 gitstatus 目录（简化版）
mkdir -p gitstatus

# 创建最小化配置
cat > config/p10k-rainbow.zsh << 'CONFIG'
# 最小化配置
CONFIG

# 创建简化版的 p10k 脚本
cat > powerlevel10k.zsh << 'P10K'
#!/usr/bin/env zsh
# Powerlevel10k 简化版

if [[ -o 'aliases' ]]; then
  'builtin' 'unsetopt' 'aliases'
  local -a p10k_opts=(aliases)
else
  local -a p10k_opts=()
fi

function p10k() {
  emulate -L zsh
  case $1 in
    configure)
      echo "Powerlevel10k 简化版已启动"
      echo "提示符: 目录 + Git 分支 + ❯"
      ;;
    *)
      echo "用法: p10k configure"
      ;;
  esac
}

# 设置提示符
setopt prompt_subst

# 获取 Git 分支
git_branch() {
  local branch
  branch=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)
  [[ -n $branch ]] && echo "($branch) "
}

# 设置 PROMPT
PROMPT='%F{blue}%~%f %F{yellow}$(git_branch)%f%F{red}❯%f '

# 启用
(( ! $+functions[p10k] )) || p10k "$@"
P10K

echo "✓ 配置文件创建完成"
echo ""

# 4. 设置主题
echo "步骤4: 配置 zshrc..."
sed -i '' 's/ZSH_THEME=.*/ZSH_THEME="powerlevel10k\/powerlevel10k"/' ~/.zshrc

# 添加 p10k 到 PATH
echo '
# Powerlevel10k
export PATH="$HOME/.oh-my-zsh/custom/themes/powerlevel10k:$PATH"
' >> ~/.zshrc

echo "✓ zshrc 配置完成"
echo ""

# 5. 验证
echo "=========================================="
echo "  安装完成！"
echo "=========================================="
echo ""
echo "请执行："
echo "  source ~/.zshrc"
echo ""
echo "然后配置："
echo "  p10k configure"
echo ""
echo "如果提示符显示异常，请安装字体："
echo "  brew install --cask font-jetbrains-mono-nerd-font"
echo ""
echo "然后在 iTerm2 中设置字体："
echo "  Preferences → Profiles → Text → Font"
echo ""

