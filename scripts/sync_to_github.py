"""
数据同步脚本 - 同步到 GitHub
"""

import os
import subprocess
from datetime import datetime
from pathlib import Path


def sync_data():
    """同步数据到 GitHub"""
    project_dir = Path(__file__).parent.parent
    os.chdir(project_dir)
    
    # 检查 git 状态
    result = subprocess.run(['git', 'status', '--porcelain'], 
                          capture_output=True, text=True)
    
    if not result.stdout.strip():
        print("📋 没有变更需要同步")
        return
    
    # 添加变更
    subprocess.run(['git', 'add', 'data/', 'logs/'])
    
    # 提交
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M')
    commit_msg = f"chore: 自动同步数据 {timestamp}"
    subprocess.run(['git', 'commit', '-m', commit_msg])
    
    # 推送
    push_result = subprocess.run(['git', 'push', 'origin', 'main'], 
                                 capture_output=True, text=True)
    
    if push_result.returncode == 0:
        print(f"✅ 数据同步成功 - {timestamp}")
    else:
        print(f"❌ 同步失败: {push_result.stderr}")


if __name__ == "__main__":
    sync_data()
