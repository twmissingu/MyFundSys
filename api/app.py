"""
MyFundSys - 基金投资管理系统后端API
提供基金数据获取、估值计算等服务
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import json
from datetime import datetime, timedelta
import random

app = Flask(__name__)
CORS(app)

# 基金代码映射
FUND_NAMES = {
    '510300': '沪深300ETF',
    '510500': '中证500ETF',
    '510050': '上证50ETF',
    '159915': '创业板ETF',
    '159901': '深证100ETF',
    '510880': '红利ETF',
    '512010': '医药ETF',
    '512170': '医疗ETF',
    '512480': '半导体ETF',
    '515030': '新能源车ETF',
    '515700': '光伏ETF',
    '512660': '军工ETF',
    '512000': '券商ETF',
    '512800': '银行ETF',
    '512200': '地产ETF',
    '159928': '消费ETF',
    '512690': '酒ETF',
    '159995': '芯片ETF',
    '515050': '5GETF',
    '512980': '传媒ETF',
    '510900': 'H股ETF',
    '159920': '恒生ETF',
    '513050': '中概互联网ETF',
    '513130': '恒生科技ETF',
    '513180': '恒生医疗ETF',
    '513100': '纳指ETF',
    '513500': '标普500ETF',
    '159941': '纳斯达克ETF',
    '513300': '纳斯达克100ETF',
    '518880': '黄金ETF',
    '159985': '豆粕ETF',
    '159981': '能源化工ETF',
    '511010': '国债ETF',
    '511220': '城投债ETF',
    '511260': '十年国债ETF',
}

@app.route('/funds', methods=['GET'])
def get_funds():
    """获取基金列表"""
    funds = []
    for code, name in FUND_NAMES.items():
        category = get_category(code)
        funds.append({
            'code': code,
            'name': name,
            'category': category,
        })
    return jsonify(funds)

@app.route('/funds/<code>', methods=['GET'])
def get_fund_detail(code):
    """获取基金详情"""
    if code not in FUND_NAMES:
        return jsonify({'error': '基金不存在'}), 404
    
    # 模拟数据，实际应从天天基金API获取
    base_nav = get_base_nav(code)
    daily_change = (random.random() - 0.5) * 0.1
    
    return jsonify({
        'code': code,
        'name': FUND_NAMES[code],
        'nav': round(base_nav * (1 + daily_change), 4),
        'nav_date': datetime.now().strftime('%Y-%m-%d'),
        'daily_change': round(daily_change, 4),
        'daily_change_rate': round(daily_change / base_nav * 100, 2),
        'category': get_category(code),
    })

@app.route('/valuation', methods=['GET'])
def get_market_valuation():
    """获取市场估值"""
    # 模拟估值数据
    pe = round(25 + random.random() * 15, 2)
    pb = round(2 + random.random() * 1.5, 2)
    percentile = round(random.random(), 4)
    temperature = int(percentile * 100)
    
    if percentile < 0.2:
        status = 'diamond'
        status_text = '钻石坑'
    elif percentile > 0.8:
        status = 'danger'
        status_text = '危险'
    else:
        status = 'normal'
        status_text = '合理'
    
    return jsonify({
        'date': datetime.now().strftime('%Y-%m-%d'),
        'pe': pe,
        'pb': pb,
        'percentile': percentile,
        'temperature': temperature,
        'status': status,
        'status_text': status_text,
    })

@app.route('/history/<code>', methods=['GET'])
def get_fund_history(code):
    """获取基金历史数据"""
    days = request.args.get('days', 252, type=int)
    
    history = []
    base_price = get_base_nav(code)
    current_price = base_price
    
    for i in range(days):
        date = datetime.now() - timedelta(days=days-i)
        if date.weekday() < 5:  # 跳过周末
            change = (random.random() - 0.5) * 0.02
            current_price = current_price * (1 + change)
            history.append({
                'date': date.strftime('%Y-%m-%d'),
                'price': round(current_price, 4),
                'pe': round(20 + random.random() * 20, 2),
                'pb': round(1.5 + random.random() * 2, 2),
            })
    
    return jsonify(history)

@app.route('/backtest', methods=['POST'])
def run_backtest():
    """运行策略回测"""
    data = request.json
    
    strategy = data.get('strategy', {})
    fund_code = data.get('fund_code', '510300')
    start_date = data.get('start_date', '2020-01-01')
    end_date = data.get('end_date', '2024-01-01')
    initial_capital = data.get('initial_capital', 100000)
    
    # 模拟回测结果
    total_return = (random.random() - 0.2) * 0.5
    trades = random.randint(10, 100)
    
    return jsonify({
        'strategy_name': strategy.get('name', '未知策略'),
        'start_date': start_date,
        'end_date': end_date,
        'initial_capital': initial_capital,
        'final_value': round(initial_capital * (1 + total_return), 2),
        'total_return': round(total_return, 4),
        'annualized_return': round(total_return / 4, 4),
        'max_drawdown': round(random.random() * 0.3, 4),
        'sharpe_ratio': round(random.random() * 2, 2),
        'trades': trades,
    })

@app.route('/articles', methods=['GET'])
def get_articles():
    """获取文章列表"""
    # 示例文章数据
    articles = [
        {
            'id': 'a001',
            'title': '随便说说股票',
            'date': '2006-03-02',
            'source': 'chinaetfs',
            'category': '投资理念',
            'tags': ['投资理念', '技术分析', '止损'],
        },
        {
            'id': 'a002',
            'title': '钻石坑与死亡之顶',
            'date': '2015-06-15',
            'source': 'chinaetfs',
            'category': '估值体系',
            'tags': ['估值', '仓位管理', '逆向投资'],
        },
    ]
    return jsonify(articles)

@app.route('/eastmoney/<path:path>', methods=['GET'])
def proxy_eastmoney(path):
    """代理东方财富API请求"""
    try:
        target_url = f'https://fundmobapi.eastmoney.com/{path}'
        params = request.args.to_dict()
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://fund.eastmoney.com/',
        }
        response = requests.get(target_url, params=params, headers=headers, timeout=10)
        return response.json(), response.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/suggest/api/suggest/get', methods=['GET'])
def proxy_eastmoney_search():
    """代理东方财富搜索API"""
    try:
        target_url = 'https://searchapi.eastmoney.com/api/suggest/get'
        params = request.args.to_dict()
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://fund.eastmoney.com/',
        }
        response = requests.get(target_url, params=params, headers=headers, timeout=10)
        return response.json(), response.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_category(code: str) -> str:
    """获取基金分类"""
    if code in ['510300', '510500', '510050', '159915', '159901', '510880']:
        return 'A股宽基'
    elif code.startswith('51') or code.startswith('15'):
        if code in ['510900', '159920', '513050', '513130', '513180']:
            return '港股'
        elif code in ['513100', '513500', '159941', '513300']:
            return '美股'
        elif code in ['518880', '159985', '159981']:
            return '商品'
        elif code in ['511010', '511220', '511260']:
            return '债券'
        else:
            return 'A股行业'
    return '其他'

def get_base_nav(code: str) -> float:
    """获取基金基准净值"""
    base_navs = {
        '510300': 3.85,
        '510500': 5.62,
        '510050': 2.45,
        '159915': 1.98,
        '159901': 2.75,
        '510880': 2.95,
        '512010': 0.85,
        '512170': 0.65,
        '512480': 1.25,
        '515030': 1.45,
        '515700': 1.15,
        '512660': 1.35,
        '512000': 0.95,
        '512800': 1.05,
        '512200': 0.75,
        '159928': 2.15,
        '512690': 0.55,
        '159995': 1.85,
        '515050': 1.05,
        '512980': 0.95,
        '510900': 1.25,
        '159920': 1.35,
        '513050': 1.15,
        '513130': 0.85,
        '513180': 0.65,
        '513100': 4.25,
        '513500': 3.15,
        '159941': 3.85,
        '513300': 4.55,
        '518880': 3.95,
        '159985': 2.25,
        '159981': 1.75,
        '511010': 105.25,
        '511220': 102.35,
        '511260': 108.45,
    }
    return base_navs.get(code, 1.0)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
