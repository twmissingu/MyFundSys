#!/bin/bash

set -e

echo "=========================================="
echo "  GitHub SSH 配置脚本"
echo "=========================================="
echo ""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd /Users/ztw/Documents/dev/MyFundSys

# 检查当前远程仓库配置
echo -e "${YELLOW}步骤 1: 检查当前远程仓库配置${NC}"
git remote -v
echo ""

# 检查是否已有 SSH 密钥
echo -e "${YELLOW}步骤 2: 检查 SSH 密钥${NC}"
SSH_KEY="$HOME/.ssh/id_ed25519"
if [ -f "$SSH_KEY" ]; then
    echo -e "${GREEN}✓ 找到已有 SSH 密钥${NC}"
    echo "公钥内容："
    cat "${SSH_KEY}.pub"
else
    echo -e "${YELLOW}未找到 SSH 密钥，将生成新密钥...${NC}"
    
    # 确保 .ssh 目录存在
    mkdir -p "$HOME/.ssh"
    chmod 700 "$HOME/.ssh"
    
    # 生成 SSH 密钥
    echo -e "${BLUE}正在生成 SSH 密钥（使用 ed25519 算法）...${NC}"
    ssh-keygen -t ed25519 -C "$(git config user.email || echo 'myfundsys@local')" -f "$SSH_KEY" -N ""
    
    echo -e "${GREEN}✓ SSH 密钥生成成功${NC}"
    echo ""
    echo "公钥内容（请复制到 GitHub）："
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    cat "${SSH_KEY}.pub"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
fi
echo ""

# 启动 ssh-agent
echo -e "${YELLOW}步骤 3: 配置 ssh-agent${NC}"
eval "$(ssh-agent -s)"
ssh-add "$SSH_KEY"
echo -e "${GREEN}✓ SSH 密钥已添加到 ssh-agent${NC}"
echo ""

# 配置 GitHub 主机密钥
echo -e "${YELLOW}步骤 4: 添加 GitHub 到 known_hosts${NC}"
if [ ! -f "$HOME/.ssh/known_hosts" ] || ! grep -q "github.com" "$HOME/.ssh/known_hosts" 2>/dev/null; then
    ssh-keyscan -t ed25519 github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null
    echo -e "${GREEN}✓ GitHub 主机密钥已添加${NC}"
else
    echo -e "${GREEN}✓ GitHub 主机密钥已存在${NC}"
fi
echo ""

# 修改远程仓库 URL 为 SSH
echo -e "${YELLOW}步骤 5: 修改远程仓库 URL${NC}"
CURRENT_URL=$(git remote get-url origin)
echo "当前 URL: $CURRENT_URL"

# 提取用户名和仓库名
if [[ $CURRENT_URL == https://github.com/* ]]; then
    # HTTPS 格式: https://github.com/username/repo.git
    REPO_PATH=${CURRENT_URL#https://github.com/}
    NEW_URL="git@github.com:${REPO_PATH}"
    
    git remote set-url origin "$NEW_URL"
    echo -e "${GREEN}✓ 已修改为 SSH URL: $NEW_URL${NC}"
elif [[ $CURRENT_URL == git@github.com:* ]]; then
    echo -e "${GREEN}✓ 已经是 SSH URL${NC}"
else
    echo -e "${RED}⚠ 无法识别的 URL 格式${NC}"
    echo "请手动修改: git remote set-url origin git@github.com:用户名/仓库名.git"
fi
echo ""

# 测试 SSH 连接
echo -e "${YELLOW}步骤 6: 测试 SSH 连接到 GitHub${NC}"
echo -e "${BLUE}正在连接...${NC}"
if ssh -T git@github.com -o StrictHostKeyChecking=accept-new 2>&1 | grep -q "successfully authenticated"; then
    echo -e "${GREEN}✓ SSH 连接成功！${NC}"
    echo ""
elif ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    echo -e "${GREEN}✓ SSH 连接成功！${NC}"
    echo ""
else
    echo -e "${RED}✗ SSH 连接测试失败${NC}"
    echo ""
    echo "如果公钥还未添加到 GitHub，请先执行以下步骤："
    echo ""
fi

# 显示配置信息
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}          SSH 配置信息${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}SSH 公钥文件:${NC} ${SSH_KEY}.pub"
echo ""
echo -e "${BLUE}公钥内容（请复制到 GitHub）:${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
cat "${SSH_KEY}.pub"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}当前远程仓库 URL:${NC}"
git remote get-url origin
echo ""

# 提示添加到 GitHub
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}      请完成以下步骤后重新推送${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "1. 登录 GitHub: https://github.com"
echo "2. 点击右上角头像 → Settings"
echo "3. 左侧菜单选择 SSH and GPG keys"
echo "4. 点击 New SSH key"
echo "5. 输入标题: MyFundSys Mac"
echo "6. 复制上面的公钥内容，粘贴到 Key 文本框"
echo "7. 点击 Add SSH key"
echo ""
echo -e "${GREEN}完成后，回到终端执行: git push origin main${NC}"
echo ""

