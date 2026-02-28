#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
E大基金代码提取脚本 v4.0
从chinaetfs-full目录下的所有文章中提取基金代码
"""

import os
import re
import json
import csv
from pathlib import Path
from collections import defaultdict

# 文章目录
ARTICLES_DIR = "/root/.openclaw/workspace/agents/fund-agent/data/etf-savior/chinaetfs-full"
OUTPUT_DIR = "/root/.openclaw/workspace/projects/fund-system/data/fund-list"

# 基金代码正则表达式（6位数字）
FUND_CODE_PATTERN = re.compile(r'\b(\d{6})\b')

# 有效的基金代码前缀 - 扩展范围
VALID_PREFIXES = ('15', '51', '16', '50', '18', '56', '52', '58', '11', '13')

# 排除的代码（日期、股票代码等）
EXCLUDE_CODES = set()

# 添加年份日期格式 20xxxx 19xxxx
for year in range(1990, 2030):
    for month in range(1, 13):
        EXCLUDE_CODES.add(f"{year}{month:02d}")

# 常见股票代码前缀（排除）
STOCK_PREFIXES = ('000', '001', '002', '003', '300', '600', '601', '603', '605', '688')
for prefix in STOCK_PREFIXES:
    for i in range(1000):
        EXCLUDE_CODES.add(f"{prefix}{i:03d}")

# 其他常见非基金代码
OTHER_EXCLUDE = [
    '477675',  # 用户ID
    '081054', '070272', '320834', '265340', '602780', '254072', '204916',
    '661655', '534846', '746668', '664672', '662012', '662011', '657635',
    '617445', '528304', '506657', '465979', '428984', '396112', '286231',
    '225234', '110924', '144210', '108105', '000012', '144565', '144210',
    # 排除17开头的（通常是图片链接或其他ID）
    '174632', '174445', '161268', '176000', '173390', '173509', '174446',
    '175738', '174902', '174515', '173746', '173582', '174514', '175185',
    '173944', '173747', '173510', '175419',
]
for code in OTHER_EXCLUDE:
    EXCLUDE_CODES.add(code)

def is_valid_fund_code(code):
    """检查是否为有效的基金代码"""
    if code in EXCLUDE_CODES:
        return False
    if not code.startswith(VALID_PREFIXES):
        return False
    # 排除明显的日期
    if code.startswith('20') and int(code[2:4]) >= 90:
        return False
    return True

def extract_fund_codes_with_context(filepath):
    """从文件中提取基金代码及其上下文"""
    fund_info = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')
            for line_num, line in enumerate(lines, 1):
                matches = FUND_CODE_PATTERN.findall(line)
                for code in matches:
                    if is_valid_fund_code(code):
                        fund_info.append({
                            'code': code,
                            'context': line.strip()[:200],
                            'file': os.path.basename(filepath),
                            'line': line_num
                        })
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
    return fund_info

def classify_fund(code, context=''):
    """根据代码和上下文分类基金"""
    context = context.lower()
    
    # 宽基指数关键词
    broad_keywords = ['沪深300', '中证500', '上证50', '创业板', '科创板', '中证100', '中证800', 
                      '中证1000', '深证100', '深证成指', '上证综指', '中小板', '创业板50', 
                      '科创50', '中证2000', '国证2000', '全指', 'a股', '300etf', '500etf', '50etf',
                      '红利', '低波', '价值', '成长', '基本面']
    
    # 行业指数关键词
    sector_keywords = ['医药', '医疗', '消费', '白酒', '食品', '科技', '半导体', '芯片', 
                       '新能源', '光伏', '军工', '银行', '证券', '保险', '地产', '基建',
                       '传媒', '计算机', '通信', '电子', '汽车', '有色', '煤炭', '钢铁',
                       '化工', '农业', '畜牧', '养殖', '旅游', '家电', '建材', '环保',
                       '电力', '交通运输', '物流', '教育', '游戏', '互联网', '软件', '传媒业']
    
    # 商品指数关键词
    commodity_keywords = ['黄金', '白银', '原油', '商品', '有色金属', '农产品', '石油']
    
    # 债券指数关键词
    bond_keywords = ['国债', '债券', '信用债', '可转债', '短融', '中期票据', '企业债', '债基']
    
    # 海外指数关键词
    overseas_keywords = ['纳指', '纳斯达克', '标普', '标普500', '道琼斯', '恒指', '恒生', 'h股',
                         '中概', '港股', '美股', '德国', '日本', '越南', '印度', '英国', '法国', 'qdii']
    
    # 分级基金关键词
    structured_keywords = ['分级a', '分级b', 'a类', 'b类', '稳健', '进取', '分级基金']
    
    # 根据上下文分类
    for kw in structured_keywords:
        if kw in context:
            return 'structured'
    for kw in broad_keywords:
        if kw in context:
            return 'broad'
    for kw in sector_keywords:
        if kw in context:
            return 'sector'
    for kw in commodity_keywords:
        if kw in context:
            return 'commodity'
    for kw in bond_keywords:
        if kw in context:
            return 'bond'
    for kw in overseas_keywords:
        if kw in context:
            return 'overseas'
    
    # 根据代码前缀和范围初步判断
    if code.startswith(('51', '56', '58')):
        return 'broad'  # 默认为宽基
    elif code.startswith('15'):
        # 15开头可能是分级基金或ETF
        second = int(code[1:2])
        if second >= 0 and second <= 2:
            return 'structured'  # 150-152通常是分级基金
        return 'sector'  # 其他可能是行业ETF
    elif code.startswith('16'):
        return 'overseas'  # 默认为QDII/LOF
    elif code.startswith('11'):
        return 'bond'  # 11开头通常是债券
    elif code.startswith('13'):
        return 'overseas'  # 13开头可能是QDII
    
    return 'unknown'

def get_market(code):
    """判断所属市场"""
    if code.startswith(('51', '56', '58', '50')):
        return '沪市'
    elif code.startswith(('15', '16', '18')):
        return '深市'
    elif code.startswith(('11', '13')):
        return '跨市场'
    return '未知'

def get_asset_type(category):
    """判断资产类别"""
    asset_map = {
        'broad': '股票',
        'sector': '股票',
        'commodity': '商品',
        'bond': '债券',
        'overseas': '股票',
        'structured': '混合型'
    }
    return asset_map.get(category, '未知')

def main():
    print("=" * 60)
    print("E大基金代码提取工具 v4.0")
    print("=" * 60)
    
    # 确保输出目录存在
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 获取所有文章文件
    article_files = list(Path(ARTICLES_DIR).glob('*.md'))
    print(f"\n找到 {len(article_files)} 篇文章")
    
    # 提取所有基金代码
    all_funds = []
    all_codes = set()
    
    for i, filepath in enumerate(article_files, 1):
        if i % 50 == 0:
            print(f"  处理中... {i}/{len(article_files)}")
        
        fund_info = extract_fund_codes_with_context(str(filepath))
        for info in fund_info:
            all_codes.add(info['code'])
            all_funds.append(info)
    
    print(f"\n提取完成！")
    print(f"  - 唯一基金代码数量: {len(all_codes)}")
    print(f"  - 总提及次数: {len(all_funds)}")
    
    # 分类统计
    category_count = defaultdict(int)
    code_mentions = defaultdict(int)
    
    for fund in all_funds:
        code = fund['code']
        context = fund['context']
        category = classify_fund(code, context)
        category_count[category] += 1
        code_mentions[code] += 1
    
    # 生成基金清单
    fund_list = []
    for code in sorted(all_codes):
        # 找到该代码最常见的上下文
        contexts = [f['context'] for f in all_funds if f['code'] == code]
        most_common_context = max(set(contexts), key=contexts.count) if contexts else ''
        
        category = classify_fund(code, most_common_context)
        fund_list.append({
            'code': code,
            'category': category,
            'market': get_market(code),
            'asset_type': get_asset_type(category),
            'mentions': code_mentions[code],
            'context': most_common_context[:100]
        })
    
    # 保存CSV
    csv_path = os.path.join(OUTPUT_DIR, 'fund_list.csv')
    with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=['code', 'category', 'market', 'asset_type', 'mentions', 'context'])
        writer.writeheader()
        writer.writerows(fund_list)
    print(f"\n✓ 基金清单已保存: {csv_path}")
    
    # 生成分类表
    classification = defaultdict(list)
    for fund in fund_list:
        classification[fund['category']].append(fund['code'])
    
    classification_path = os.path.join(OUTPUT_DIR, 'fund_classification.json')
    with open(classification_path, 'w', encoding='utf-8') as f:
        json.dump({
            'categories': {
                'broad': {'name': '宽基指数', 'codes': classification['broad']},
                'sector': {'name': '行业指数', 'codes': classification['sector']},
                'commodity': {'name': '商品指数', 'codes': classification['commodity']},
                'bond': {'name': '债券指数', 'codes': classification['bond']},
                'overseas': {'name': '海外指数', 'codes': classification['overseas']},
                'structured': {'name': '分级基金', 'codes': classification['structured']},
                'unknown': {'name': '未分类', 'codes': classification['unknown']}
            },
            'summary': {
                'total_codes': len(all_codes),
                'broad': len(classification['broad']),
                'sector': len(classification['sector']),
                'commodity': len(classification['commodity']),
                'bond': len(classification['bond']),
                'overseas': len(classification['overseas']),
                'structured': len(classification['structured']),
                'unknown': len(classification['unknown'])
            }
        }, f, ensure_ascii=False, indent=2)
    print(f"✓ 基金分类表已保存: {classification_path}")
    
    # 生成分类CSV
    classification_csv = os.path.join(OUTPUT_DIR, 'fund_classification.csv')
    with open(classification_csv, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(['分类代码', '分类名称', '基金代码', '市场', '资产类别', '提及次数'])
        category_names = {
            'broad': '宽基指数',
            'sector': '行业指数',
            'commodity': '商品指数',
            'bond': '债券指数',
            'overseas': '海外指数',
            'structured': '分级基金',
            'unknown': '未分类'
        }
        for fund in sorted(fund_list, key=lambda x: (x['category'], x['code'])):
            writer.writerow([
                fund['category'],
                category_names.get(fund['category'], '未知'),
                fund['code'],
                fund['market'],
                fund['asset_type'],
                fund['mentions']
            ])
    print(f"✓ 分类CSV已保存: {classification_csv}")
    
    # 打印统计
    print("\n" + "=" * 60)
    print("统计摘要")
    print("=" * 60)
    print(f"宽基指数: {len(classification['broad'])} 只")
    print(f"行业指数: {len(classification['sector'])} 只")
    print(f"商品指数: {len(classification['commodity'])} 只")
    print(f"债券指数: {len(classification['bond'])} 只")
    print(f"海外指数: {len(classification['overseas'])} 只")
    print(f"分级基金: {len(classification['structured'])} 只")
    print(f"未分类: {len(classification['unknown'])} 只")
    print(f"总计: {len(all_codes)} 只")
    
    # 打印提及最多的前30
    print("\n" + "=" * 60)
    print("提及次数最多的基金代码 (Top 30)")
    print("=" * 60)
    top_mentions = sorted(fund_list, key=lambda x: x['mentions'], reverse=True)[:30]
    for i, fund in enumerate(top_mentions, 1):
        print(f"{i:2d}. {fund['code']} - {fund['mentions']}次 ({fund['category']})")
    
    # 保存所有基金代码列表（纯文本）
    codes_txt_path = os.path.join(OUTPUT_DIR, 'fund_codes.txt')
    with open(codes_txt_path, 'w', encoding='utf-8') as f:
        f.write("# E大基金代码列表\n")
        f.write(f"# 提取时间: {os.popen('date').read().strip()}\n")
        f.write(f"# 来源: chinaetfs-full ({len(article_files)}篇文章)\n")
        f.write(f"# 总计: {len(all_codes)}只基金\n\n")
        
        for category in ['broad', 'sector', 'commodity', 'bond', 'overseas', 'structured', 'unknown']:
            codes = classification[category]
            if codes:
                f.write(f"\n## {category_names.get(category, category)} ({len(codes)}只)\n")
                f.write(", ".join(sorted(codes)) + "\n")
    print(f"✓ 基金代码文本已保存: {codes_txt_path}")
    
    print("\n" + "=" * 60)
    print("提取完成！")
    print("=" * 60)

if __name__ == '__main__':
    main()
