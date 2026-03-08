#!/bin/bash

set -e  # 遇到错误立即退出

echo "=========================================="
echo "  MyFundSys 环境安装脚本"
echo "=========================================="
echo ""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否已安装 Homebrew
check_homebrew() {
    if command -v brew &> /dev/null; then
        echo -e "${GREEN}✓ Homebrew 已安装${NC}"
        brew --version
        return 0
    else
        return 1
    fi
}

# 安装 Homebrew
install_homebrew() {
    echo -e "${YELLOW}正在安装 Homebrew...${NC}"
    echo "这可能需要几分钟时间，请耐心等待..."
    echo ""
    
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # 配置 Homebrew 环境变量
    echo ""
    echo -e "${YELLOW}配置 Homebrew 环境变量...${NC}"
    
    if [[ $(uname -m) == "arm64" ]]; then
        # Apple Silicon Mac
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    else
        # Intel Mac
        echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/usr/local/bin/brew shellenv)"
    fi
    
    echo -e "${GREEN}✓ Homebrew 安装完成${NC}"
}

# 检查是否已安装 Node.js
check_node() {
    if command -v node &> /dev/null; then
        echo -e "${GREEN}✓ Node.js 已安装${NC}"
        echo "  版本: $(node -v)"
        echo "  npm: $(npm -v)"
        return 0
    else
        return 1
    fi
}

# 安装 Node.js
install_node() {
    echo -e "${YELLOW}正在安装 Node.js...${NC}"
    echo ""
    
    brew install node
    
    echo ""
    echo -e "${GREEN}✓ Node.js 安装完成${NC}"
    echo "  版本: $(node -v)"
    echo "  npm: $(npm -v)"
}

# 主流程
main() {
    # 检查 Homebrew
    if ! check_homebrew; then
        install_homebrew
    fi
    
    echo ""
    
    # 检查 Node.js
    if ! check_node; then
        install_node
    fi
    
    echo ""
    echo "=========================================="
    echo -e "${GREEN}  环境安装完成！${NC}"
    echo "=========================================="
    echo ""
    echo "现在可以启动 MyFundSys 了："
    echo ""
    echo "  cd /Users/ztw/Documents/dev/MyFundSys/frontend"
    echo "  npm install"
    echo "  npm run dev"
    echo ""
    echo "然后在浏览器访问: http://localhost:5173/MyFundSys/"
    echo ""
    echo -e "${YELLOW}提示: 如果命令找不到，请关闭终端重新打开${NC}"
}

# 运行主流程
main
