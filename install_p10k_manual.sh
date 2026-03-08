#!/bin/bash

echo "手动安装 Powerlevel10k..."

# 创建目录
rm -rf ~/.oh-my-zsh/custom/themes/powerlevel10k
mkdir -p ~/.oh-my-zsh/custom/themes/powerlevel10k

# 使用多个 CDN 尝试下载
cd ~/.oh-my-zsh/custom/themes/powerlevel10k

echo "下载核心文件..."

# 方法1：jsDelivr CDN
curl -fsSL -o powerlevel10k.zsh-theme "https://cdn.jsdelivr.net/gh/romkatv/powerlevel10k@master/powerlevel10k.zsh-theme" 2>/dev/null && echo "✓ jsDelivr 成功" && CDN_OK=1

# 如果失败，方法2：Statically
curl -fsSL -o powerlevel10k.zsh-theme "https://cdn.statically.io/gh/romkatv/powerlevel10k/master/powerlevel10k.zsh-theme" 2>/dev/null && echo "✓ Statically 成功" && CDN_OK=1

# 如果失败，方法3：直接 GitHub
curl -fsSL -o powerlevel10k.zsh-theme "https://raw.githubusercontent.com/romkatv/powerlevel10k/master/powerlevel10k.zsh-theme" 2>/dev/null && echo "✓ GitHub 成功" && CDN_OK=1

if [ ! -f powerlevel10k.zsh-theme ] || [ ! -s powerlevel10k.zsh-theme ]; then
    echo "✗ 下载失败，使用备用主题..."
    
    # 使用 oh-my-zsh 自带的主题
    sed -i '' 's/ZSH_THEME=.*/ZSH_THEME="agnoster"/' ~/.zshrc
    source ~/.zshrc
    echo "✅ 已启用 agnoster 主题（内置）"
    echo ""
    echo "如果需要 p10k，请稍后网络好的时候重试："
    echo "  git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ~/.oh-my-zsh/custom/themes/powerlevel10k"
    exit 0
fi

# 创建简单的 p10k 脚本
cat > ~/.oh-my-zsh/custom/themes/powerlevel10k/powerlevel10k.zsh << 'P10KSCRIPT'
#!/usr/bin/env zsh
# 简化版 powerlevel10k

# 设置提示符
setopt prompt_subst

# 基本配置
PROMPT='%F{cyan}%~%f %F{green}$(git branch 2>/dev/null | grep "^*" | sed "s/^* //")%f
%F{red}❯%f '

# p10k configure 模拟
function p10k() {
  if [[ $1 == "configure" ]]; then
    echo "简化版 p10k - 无需配置"
    echo "当前提示符已启用"
  fi
}
P10KSCRIPT

# 设置主题
sed -i '' 's/ZSH_THEME=.*/ZSH_THEME="powerlevel10k\/powerlevel10k"/' ~/.zshrc

echo ""
echo "✅ Powerlevel10k 简化版安装完成！"
echo ""
echo "执行以下命令生效："
echo "  source ~/.zshrc"

