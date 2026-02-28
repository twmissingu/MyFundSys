#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
E大基金代码提取脚本 v5.0 - 完整版
从chinaetfs-full目录提取 + 基于E大投资风格补充常见基金
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

# 有效的基金代码前缀
VALID_PREFIXES = ('15', '51', '16', '50', '18', '56', '52', '58', '11', '13')

# 排除的代码
EXCLUDE_CODES = set()
for year in range(1990, 2030):
    for month in range(1, 13):
        EXCLUDE_CODES.add(f"{year}{month:02d}")
STOCK_PREFIXES = ('000', '001', '002', '003', '300', '600', '601', '603', '605', '688')
for prefix in STOCK_PREFIXES:
    for i in range(1000):
        EXCLUDE_CODES.add(f"{prefix}{i:03d}")
OTHER_EXCLUDE = [
    '477675', '081054', '070272', '320834', '265340', '602780', '254072', '204916',
    '661655', '534846', '746668', '664672', '662012', '662011', '657635',
    '617445', '528304', '506657', '465979', '428984', '396112', '286231',
    '225234', '110924', '144210', '108105', '000012', '144565', '144210',
    '174632', '174445', '161268', '176000', '173390', '173509', '174446',
    '175738', '174902', '174515', '173746', '173582', '174514', '175185',
    '173944', '173747', '173510', '175419',
]
for code in OTHER_EXCLUDE:
    EXCLUDE_CODES.add(code)

def is_valid_fund_code(code):
    if code in EXCLUDE_CODES:
        return False
    if not code.startswith(VALID_PREFIXES):
        return False
    if code.startswith('20') and int(code[2:4]) >= 90:
        return False
    return True

def extract_fund_codes_with_context(filepath):
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
    context = context.lower()
    
    broad_keywords = ['沪深300', '中证500', '上证50', '创业板', '科创板', '中证100', '中证800', 
                      '中证1000', '深证100', '深证成指', '上证综指', '中小板', '创业板50', 
                      '科创50', '中证2000', '国证2000', '全指', 'a股', '300etf', '500etf', '50etf',
                      '红利', '低波', '价值', '成长', '基本面']
    
    sector_keywords = ['医药', '医疗', '消费', '白酒', '食品', '科技', '半导体', '芯片', 
                       '新能源', '光伏', '军工', '银行', '证券', '保险', '地产', '基建',
                       '传媒', '计算机', '通信', '电子', '汽车', '有色', '煤炭', '钢铁',
                       '化工', '农业', '畜牧', '养殖', '旅游', '家电', '建材', '环保',
                       '电力', '交通运输', '物流', '教育', '游戏', '互联网', '软件', '传媒业']
    
    commodity_keywords = ['黄金', '白银', '原油', '商品', '有色金属', '农产品', '石油']
    
    bond_keywords = ['国债', '债券', '信用债', '可转债', '短融', '中期票据', '企业债', '债基']
    
    overseas_keywords = ['纳指', '纳斯达克', '标普', '标普500', '道琼斯', '恒指', '恒生', 'h股',
                         '中概', '港股', '美股', '德国', '日本', '越南', '印度', '英国', '法国', 'qdii']
    
    structured_keywords = ['分级a', '分级b', 'a类', 'b类', '稳健', '进取', '分级基金']
    
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
    
    if code.startswith(('51', '56', '58')):
        return 'broad'
    elif code.startswith('15'):
        second = int(code[1:2])
        if second >= 0 and second <= 2:
            return 'structured'
        return 'sector'
    elif code.startswith('16'):
        return 'overseas'
    elif code.startswith('11'):
        return 'bond'
    elif code.startswith('13'):
        return 'overseas'
    
    return 'unknown'

def get_market(code):
    if code.startswith(('51', '56', '58', '50')):
        return '沪市'
    elif code.startswith(('15', '16', '18')):
        return '深市'
    elif code.startswith(('11', '13')):
        return '跨市场'
    return '未知'

def get_asset_type(category):
    asset_map = {
        'broad': '股票',
        'sector': '股票',
        'commodity': '商品',
        'bond': '债券',
        'overseas': '股票',
        'structured': '混合型'
    }
    return asset_map.get(category, '未知')

# E大常用基金池（基于投资风格和文章上下文补充）
E_FUND_POOL = {
    # 宽基指数
    'broad': [
        # 沪深300
        {'code': '510300', 'name': '华泰柏瑞沪深300ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '510330', 'name': '华夏沪深300ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '510310', 'name': '易方达沪深300ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '159919', 'name': '嘉实沪深300ETF', 'market': '深市', 'asset_type': '股票'},
        # 中证500
        {'code': '510500', 'name': '南方中证500ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '510510', 'name': '广发中证500ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '510520', 'name': '诺安中证500ETF', 'market': '沪市', 'asset_type': '股票'},
        # 上证50
        {'code': '510050', 'name': '华夏上证50ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '510100', 'name': '易方达上证50ETF', 'market': '沪市', 'asset_type': '股票'},
        # 创业板
        {'code': '159915', 'name': '易方达创业板ETF', 'market': '深市', 'asset_type': '股票'},
        {'code': '159952', 'name': '广发创业板ETF', 'market': '深市', 'asset_type': '股票'},
        {'code': '159949', 'name': '华安创业板50ETF', 'market': '深市', 'asset_type': '股票'},
        # 科创板
        {'code': '588000', 'name': '华夏科创50ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '588080', 'name': '易方达科创50ETF', 'market': '沪市', 'asset_type': '股票'},
        # 中证1000
        {'code': '512100', 'name': '南方中证1000ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '159845', 'name': '华夏中证1000ETF', 'market': '深市', 'asset_type': '股票'},
        # 深证100
        {'code': '159901', 'name': '易方达深证100ETF', 'market': '深市', 'asset_type': '股票'},
        # 中小板
        {'code': '159902', 'name': '华夏中小板ETF', 'market': '深市', 'asset_type': '股票'},
        # 红利
        {'code': '510880', 'name': '华泰柏瑞红利ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '515180', 'name': '红利低波100ETF', 'market': '沪市', 'asset_type': '股票'},
        # 恒生
        {'code': '159920', 'name': '华夏恒生ETF', 'market': '深市', 'asset_type': '股票'},
        {'code': '510900', 'name': '易方达恒生国企ETF', 'market': '沪市', 'asset_type': '股票'},
    ],
    # 行业指数
    'sector': [
        # 医药医疗
        {'code': '512010', 'name': '易方达沪深300医药ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '512170', 'name': '华宝中证医疗ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '159938', 'name': '广发中证全指医药卫生ETF', 'market': '深市', 'asset_type': '股票'},
        {'code': '159992', 'name': '华夏创新药ETF', 'market': '深市', 'asset_type': '股票'},
        # 消费
        {'code': '159928', 'name': '汇添富中证主要消费ETF', 'market': '深市', 'asset_type': '股票'},
        {'code': '512690', 'name': '酒ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '159996', 'name': '家电ETF', 'market': '深市', 'asset_type': '股票'},
        # 科技
        {'code': '515000', 'name': '科技ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '515050', 'name': '5GETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '512480', 'name': '半导体ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '159995', 'name': '芯片ETF', 'market': '深市', 'asset_type': '股票'},
        # 新能源
        {'code': '515030', 'name': '新能源车ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '516160', 'name': '新能源ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '159857', 'name': '光伏ETF', 'market': '深市', 'asset_type': '股票'},
        # 军工
        {'code': '512660', 'name': '军工ETF', 'market': '沪市', 'asset_type': '股票'},
        # 金融
        {'code': '512800', 'name': '银行ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '512000', 'name': '券商ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '512880', 'name': '证券ETF', 'market': '沪市', 'asset_type': '股票'},
        # 地产
        {'code': '512200', 'name': '房地产ETF', 'market': '沪市', 'asset_type': '股票'},
        # 传媒
        {'code': '512980', 'name': '传媒ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '159805', 'name': '传媒ETF', 'market': '深市', 'asset_type': '股票'},
        # 有色
        {'code': '512400', 'name': '有色金属ETF', 'market': '沪市', 'asset_type': '股票'},
        # 煤炭
        {'code': '515220', 'name': '煤炭ETF', 'market': '沪市', 'asset_type': '股票'},
        # 钢铁
        {'code': '515210', 'name': '钢铁ETF', 'market': '沪市', 'asset_type': '股票'},
        # 农业
        {'code': '159825', 'name': '农业ETF', 'market': '深市', 'asset_type': '股票'},
        {'code': '159867', 'name': '畜牧ETF', 'market': '深市', 'asset_type': '股票'},
    ],
    # 商品指数
    'commodity': [
        {'code': '518880', 'name': '华安黄金ETF', 'market': '沪市', 'asset_type': '商品'},
        {'code': '518800', 'name': '国泰黄金ETF', 'market': '沪市', 'asset_type': '商品'},
        {'code': '159934', 'name': '易方达黄金ETF', 'market': '深市', 'asset_type': '商品'},
        {'code': '159937', 'name': '博时黄金ETF', 'market': '深市', 'asset_type': '商品'},
        {'code': '501018', 'name': '南方原油LOF', 'market': '沪市', 'asset_type': '商品'},
        {'code': '162411', 'name': '华宝油气LOF', 'market': '深市', 'asset_type': '商品'},
    ],
    # 债券指数
    'bond': [
        {'code': '511010', 'name': '国债ETF', 'market': '沪市', 'asset_type': '债券'},
        {'code': '511220', 'name': '城投债ETF', 'market': '沪市', 'asset_type': '债券'},
        {'code': '511260', 'name': '十年国债ETF', 'market': '沪市', 'asset_type': '债券'},
    ],
    # 海外指数
    'overseas': [
        {'code': '513100', 'name': '国泰纳斯达克100ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '513300', 'name': '纳斯达克ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '159941', 'name': '纳指ETF', 'market': '深市', 'asset_type': '股票'},
        {'code': '513500', 'name': '标普500ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '513030', 'name': '德国30ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '513050', 'name': '中概互联网ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '164906', 'name': '交银中证海外中国互联网指数', 'market': '深市', 'asset_type': '股票'},
        {'code': '513180', 'name': '恒生科技ETF', 'market': '沪市', 'asset_type': '股票'},
        {'code': '513060', 'name': '恒生医疗ETF', 'market': '沪市', 'asset_type': '股票'},
    ],
    # 分级基金（历史数据，已逐步退出）
    'structured': [
        {'code': '150018', 'name': '银华稳进', 'market': '深市', 'asset_type': '混合型'},
        {'code': '150019', 'name': '银华锐进', 'market': '深市', 'asset_type': '混合型'},
        {'code': '150023', 'name': '申万收益', 'market': '深市', 'asset_type': '混合型'},
        {'code': '150022', 'name': '申万进取', 'market': '深市', 'asset_type': '混合型'},
    ]
}

def main():
    print("=" * 60)
    print("E大基金代码提取工具 v5.0 - 完整版")
    print("=" * 60)
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 1. 从文章中提取基金代码
    article_files = list(Path(ARTICLES_DIR).glob('*.md'))
    print(f"\n第一步：从 {len(article_files)} 篇文章中提取基金代码")
    
    all_funds = []
    all_codes = set()
    
    for i, filepath in enumerate(article_files, 1):
        if i % 50 == 0:
            print(f"  处理中... {i}/{len(article_files)}")
        
        fund_info = extract_fund_codes_with_context(str(filepath))
        for info in fund_info:
            all_codes.add(info['code'])
            all_funds.append(info)
    
    print(f"  从文章提取: {len(all_codes)} 只基金")
    
    # 2. 合并E大基金池
    print(f"\n第二步：合并E大常用基金池")
    
    fund_list = []
    extracted_codes = set()
    
    # 先添加从文章提取的基金
    for code in sorted(all_codes):
        contexts = [f['context'] for f in all_funds if f['code'] == code]
        most_common_context = max(set(contexts), key=contexts.count) if contexts else ''
        mentions = len([f for f in all_funds if f['code'] == code])
        category = classify_fund(code, most_common_context)
        
        fund_list.append({
            'code': code,
            'name': '',  # 从文章提取的没有名称
            'category': category,
            'market': get_market(code),
            'asset_type': get_asset_type(category),
            'mentions': mentions,
            'source': 'article',
            'context': most_common_context[:100]
        })
        extracted_codes.add(code)
    
    # 再添加基金池中的基金（去重）
    for category, funds in E_FUND_POOL.items():
        for fund in funds:
            if fund['code'] not in extracted_codes:
                fund_list.append({
                    'code': fund['code'],
                    'name': fund['name'],
                    'category': category,
                    'market': fund['market'],
                    'asset_type': fund['asset_type'],
                    'mentions': 0,
                    'source': 'pool',
                    'context': ''
                })
    
    total_codes = len(fund_list)
    print(f"  合并后总计: {total_codes} 只基金")
    
    # 3. 生成分类统计
    classification = defaultdict(list)
    for fund in fund_list:
        classification[fund['category']].append(fund['code'])
    
    # 4. 保存CSV
    csv_path = os.path.join(OUTPUT_DIR, 'fund_list_complete.csv')
    with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=['code', 'name', 'category', 'market', 'asset_type', 'mentions', 'source'])
        writer.writeheader()
        for fund in sorted(fund_list, key=lambda x: (x['category'], x['code'])):
            writer.writerow({
                'code': fund['code'],
                'name': fund['name'],
                'category': fund['category'],
                'market': fund['market'],
                'asset_type': fund['asset_type'],
                'mentions': fund['mentions'],
                'source': fund['source']
            })
    print(f"\n✓ 完整基金清单已保存: {csv_path}")
    
    # 5. 生成分类表JSON
    category_names = {
        'broad': '宽基指数',
        'sector': '行业指数',
        'commodity': '商品指数',
        'bond': '债券指数',
        'overseas': '海外指数',
        'structured': '分级基金',
        'unknown': '未分类'
    }
    
    classification_path = os.path.join(OUTPUT_DIR, 'fund_classification_complete.json')
    with open(classification_path, 'w', encoding='utf-8') as f:
        json.dump({
            'categories': {
                cat: {
                    'name': category_names.get(cat, cat),
                    'count': len(classification[cat]),
                    'funds': [
                        {'code': f['code'], 'name': f['name'], 'market': f['market']}
                        for f in fund_list if f['category'] == cat
                    ]
                }
                for cat in classification.keys()
            },
            'summary': {
                'total_codes': total_codes,
                'from_article': len(all_codes),
                'from_pool': total_codes - len(all_codes),
                **{cat: len(classification[cat]) for cat in classification.keys()}
            }
        }, f, ensure_ascii=False, indent=2)
    print(f"✓ 分类表已保存: {classification_path}")
    
    # 6. 生成分类CSV
    classification_csv = os.path.join(OUTPUT_DIR, 'fund_classification_complete.csv')
    with open(classification_csv, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(['分类代码', '分类名称', '基金代码', '基金名称', '市场', '资产类别', '来源'])
        for fund in sorted(fund_list, key=lambda x: (x['category'], x['code'])):
            writer.writerow([
                fund['category'],
                category_names.get(fund['category'], '未知'),
                fund['code'],
                fund['name'],
                fund['market'],
                fund['asset_type'],
                fund['source']
            ])
    print(f"✓ 分类CSV已保存: {classification_csv}")
    
    # 7. 打印统计
    print("\n" + "=" * 60)
    print("统计摘要")
    print("=" * 60)
    for cat in ['broad', 'sector', 'commodity', 'bond', 'overseas', 'structured', 'unknown']:
        if cat in classification:
            print(f"{category_names.get(cat, cat)}: {len(classification[cat])} 只")
    print(f"总计: {total_codes} 只 (文章提取: {len(all_codes)}, 基金池补充: {total_codes - len(all_codes)})")
    
    # 8. 保存基金代码文本
    codes_txt_path = os.path.join(OUTPUT_DIR, 'fund_codes_complete.txt')
    with open(codes_txt_path, 'w', encoding='utf-8') as f:
        f.write("# E大基金代码完整列表\n")
        f.write(f"# 提取时间: {os.popen('date').read().strip()}\n")
        f.write(f"# 来源: chinaetfs-full ({len(article_files)}篇文章) + E大基金池\n")
        f.write(f"# 总计: {total_codes}只基金\n\n")
        
        for category in ['broad', 'sector', 'commodity', 'bond', 'overseas', 'structured', 'unknown']:
            if category in classification:
                funds = [f for f in fund_list if f['category'] == category]
                f.write(f"\n## {category_names.get(category, category)} ({len(funds)}只)\n")
                for fund in sorted(funds, key=lambda x: x['code']):
                    name = f" - {fund['name']}" if fund['name'] else ""
                    f.write(f"{fund['code']}{name}\n")
    print(f"✓ 基金代码文本已保存: {codes_txt_path}")
    
    print("\n" + "=" * 60)
    print("提取完成！")
    print("=" * 60)

if __name__ == '__main__':
    main()
