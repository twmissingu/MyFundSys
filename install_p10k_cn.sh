#!/bin/bash

echo "安装 Powerlevel10k（国内源）..."

# 方法1：使用 jsdelivr CDN 加速 GitHub
echo "尝试从 CDN 下载..."
cd /tmp
curl -L -o p10k.tar.gz "https://gh.api.99988866.xyz/https://github.com/romkatv/powerlevel10k/archive/refs/heads/master.tar.gz" 2>/dev/null || \
curl -L -o p10k.tar.gz "https://github.moeyy.xyz/https://github.com/romkatv/powerlevel10k/archive/refs/heads/master.tar.gz" 2>/dev/null || \
curl -L -o p10k.tar.gz "https://ghproxy.com/https://github.com/romkatv/powerlevel10k/archive/refs/heads/master.tar.gz" 2>/dev/null

if [ -f p10k.tar.gz ]; then
    echo "✓ 下载成功"
    rm -rf ~/.oh-my-zsh/custom/themes/powerlevel10k
    mkdir -p ~/.oh-my-zsh/custom/themes/powerlevel10k
    tar -xzf p10k.tar.gz -C ~/.oh-my-zsh/custom/themes/ --strip-components=1
    rm p10k.tar.gz
    echo "✓ 安装完成"
else
    echo "✗ 下载失败，使用备用方案..."
    # 备用：直接下载单个文件
    mkdir -p ~/.oh-my-zsh/custom/themes/powerlevel10k
    curl -L -o ~/.oh-my-zsh/custom/themes/powerlevel10k/powerlevel10k.zsh-theme "https://raw.githubusercontent.com/romkatv/powerlevel10k/master/powerlevel10k.zsh-theme" 2>/dev/null
fi

# 设置主题
sed -i '' 's/ZSH_THEME=.*/ZSH_THEME="powerlevel10k\/powerlevel10k"/' ~/.zshrc

echo ""
echo "✅ Powerlevel10k 安装完成！"
echo ""
echo "请执行以下命令："
echo "  source ~/.zshrc"
echo "  p10k configure"

