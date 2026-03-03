"""
资产分析器 - 基金系统核心分析模块
负责计算资产数据、行业占比、市场分布和收益指标
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
import statistics


@dataclass
class FundPosition:
    """基金持仓数据"""
    code: str                          # 基金代码
    name: str                          # 基金名称
    shares: Decimal                    # 持有份额
    nav: Decimal                       # 最新净值
    cost_price: Decimal                # 成本价
    category: str                      # 基金类型
    market: str                        # 市场 (A股/港股/美股/债券/商品)
    industry: Optional[str] = None     # 主要行业
    
    @property
    def market_value(self) -> Decimal:
        """市值 = 份额 × 净值"""
        return (self.shares * self.nav).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    @property
    def cost_value(self) -> Decimal:
        """成本 = 份额 × 成本价"""
        return (self.shares * self.cost_price).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    @property
    def profit_loss(self) -> Decimal:
        """盈亏金额"""
        return self.market_value - self.cost_value
    
    @property
    def profit_loss_pct(self) -> Decimal:
        """盈亏比例"""
        if self.cost_value == 0:
            return Decimal('0')
        return ((self.market_value - self.cost_value) / self.cost_value * 100).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )


@dataclass
class AssetAllocation:
    """资产配置分析结果"""
    total_assets: Decimal
    total_cost: Decimal
    total_profit_loss: Decimal
    total_return_pct: Decimal
    
    # 市场分布
    market_distribution: Dict[str, Decimal] = field(default_factory=dict)
    
    # 行业分布
    industry_distribution: Dict[str, Decimal] = field(default_factory=dict)
    
    # 类型分布
    category_distribution: Dict[str, Decimal] = field(default_factory=dict)
    
    # 持仓明细
    positions: List[FundPosition] = field(default_factory=list)


@dataclass
class ReturnMetrics:
    """收益指标"""
    total_return: Decimal              # 总收益率 (%)
    annualized_return: Decimal         # 年化收益率 (%)
    max_drawdown: Decimal              # 最大回撤 (%)
    sharpe_ratio: Optional[Decimal] = None  # 夏普比率
    volatility: Optional[Decimal] = None    # 波动率
    
    # 时间区间收益
    returns_1m: Optional[Decimal] = None
    returns_3m: Optional[Decimal] = None
    returns_6m: Optional[Decimal] = None
    returns_1y: Optional[Decimal] = None
    returns_ytd: Optional[Decimal] = None


class AssetAnalyzer:
    """资产分析器"""
    
    # 市场分类映射
    MARKET_MAP = {
        'A股': ['股票型', '混合型', '指数型', 'ETF'],
        '港股': ['港股', '香港', '恒生'],
        '美股': ['美股', '纳斯达克', '标普', 'QDII'],
        '债券': ['债券型', '纯债', '可转债'],
        '商品': ['商品', '黄金', '原油', 'REITs'],
        '货币': ['货币型', '现金'],
    }
    
    def __init__(self):
        self.positions: List[FundPosition] = []
        self.price_history: Dict[str, List[Tuple[datetime, Decimal]]] = {}
    
    def add_position(self, position: FundPosition) -> None:
        """添加持仓"""
        self.positions.append(position)
    
    def remove_position(self, code: str) -> bool:
        """移除持仓"""
        for i, pos in enumerate(self.positions):
            if pos.code == code:
                del self.positions[i]
                return True
        return False
    
    def analyze_allocation(self) -> AssetAllocation:
        """分析资产配置"""
        if not self.positions:
            return AssetAllocation(
                total_assets=Decimal('0'),
                total_cost=Decimal('0'),
                total_profit_loss=Decimal('0'),
                total_return_pct=Decimal('0')
            )
        
        total_assets = sum(p.market_value for p in self.positions)
        total_cost = sum(p.cost_value for p in self.positions)
        total_pl = sum(p.profit_loss for p in self.positions)
        
        total_return_pct = Decimal('0')
        if total_cost > 0:
            total_return_pct = (total_pl / total_cost * 100).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
        
        # 计算分布
        market_dist = self._calc_market_distribution(total_assets)
        industry_dist = self._calc_industry_distribution(total_assets)
        category_dist = self._calc_category_distribution(total_assets)
        
        return AssetAllocation(
            total_assets=total_assets,
            total_cost=total_cost,
            total_profit_loss=total_pl,
            total_return_pct=total_return_pct,
            market_distribution=market_dist,
            industry_distribution=industry_dist,
            category_distribution=category_dist,
            positions=self.positions.copy()
        )
    
    def _calc_market_distribution(self, total: Decimal) -> Dict[str, Decimal]:
        """计算市场分布"""
        distribution = {market: Decimal('0') for market in self.MARKET_MAP.keys()}
        
        for pos in self.positions:
            market = self._classify_market(pos)
            distribution[market] += pos.market_value
        
        # 转换为百分比
        if total > 0:
            for market in distribution:
                distribution[market] = (distribution[market] / total * 100).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
        
        return distribution
    
    def _classify_market(self, position: FundPosition) -> str:
        """根据基金名称和类型分类市场"""
        name_upper = position.name.upper()
        category = position.category
        
        # 检查关键词（先检查港股，因为腾讯等港股可能在A股上市但属于港股）
        if any(kw in name_upper for kw in ['港股', '恒生', 'H股', '香港', '腾讯']):
            return '港股'
        elif any(kw in name_upper for kw in ['纳斯达克', '标普', '美股', '美国']):
            return '美股'
        elif any(kw in name_upper for kw in ['债券', '纯债', '可转债']):
            return '债券'
        elif any(kw in name_upper for kw in ['黄金', '原油', '商品', 'REITs']):
            return '商品'
        elif any(kw in name_upper for kw in ['货币', '现金']):
            return '货币'
        
        # 根据类型判断
        if 'QDII' in category:
            if '香港' in category or '港股' in category:
                return '港股'
            return '美股'
        elif '债券' in category:
            return '债券'
        elif '货币' in category:
            return '货币'
        
        # 默认为A股
        return 'A股'
    
    def _calc_industry_distribution(self, total: Decimal) -> Dict[str, Decimal]:
        """计算行业分布"""
        distribution: Dict[str, Decimal] = {}
        
        for pos in self.positions:
            industry = pos.industry or '其他'
            distribution[industry] = distribution.get(industry, Decimal('0')) + pos.market_value
        
        # 转换为百分比
        if total > 0:
            for industry in distribution:
                distribution[industry] = (distribution[industry] / total * 100).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
        
        return distribution
    
    def _calc_category_distribution(self, total: Decimal) -> Dict[str, Decimal]:
        """计算基金类型分布"""
        distribution: Dict[str, Decimal] = {}
        
        for pos in self.positions:
            category = pos.category
            distribution[category] = distribution.get(category, Decimal('0')) + pos.market_value
        
        # 转换为百分比
        if total > 0:
            for category in distribution:
                distribution[category] = (distribution[category] / total * 100).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
        
        return distribution
    
    def calculate_returns(self, nav_history: Dict[str, List[Tuple[datetime, Decimal]]]) -> ReturnMetrics:
        """计算收益指标"""
        if not self.positions or not nav_history:
            return ReturnMetrics(total_return=Decimal('0'))
        
        # 计算总收益率
        total_cost = sum(p.cost_value for p in self.positions)
        total_value = sum(p.market_value for p in self.positions)
        total_return = Decimal('0')
        if total_cost > 0:
            total_return = ((total_value - total_cost) / total_cost * 100).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
        
        # 计算最大回撤
        max_dd = self._calculate_max_drawdown(nav_history)
        
        # 计算年化收益（假设有历史数据）
        annualized = self._calculate_annualized_return(nav_history)
        
        return ReturnMetrics(
            total_return=total_return,
            annualized_return=annualized,
            max_drawdown=max_dd
        )
    
    def _calculate_max_drawdown(self, nav_history: Dict[str, List[Tuple[datetime, Decimal]]]) -> Decimal:
        """计算最大回撤"""
        if not nav_history:
            return Decimal('0')
        
        max_dd = Decimal('0')
        
        for code, history in nav_history.items():
            if len(history) < 2:
                continue
            
            # 按时间排序
            sorted_history = sorted(history, key=lambda x: x[0])
            navs = [h[1] for h in sorted_history]
            
            peak = navs[0]
            for nav in navs[1:]:
                if nav > peak:
                    peak = nav
                dd = (peak - nav) / peak * 100
                if dd > max_dd:
                    max_dd = dd
        
        return max_dd.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    def _calculate_annualized_return(self, nav_history: Dict[str, List[Tuple[datetime, Decimal]]]) -> Decimal:
        """计算年化收益率"""
        if not nav_history:
            return Decimal('0')
        
        # 获取最早和最晚的日期
        all_dates = []
        for history in nav_history.values():
            all_dates.extend([h[0] for h in history])
        
        if len(all_dates) < 2:
            return Decimal('0')
        
        min_date = min(all_dates)
        max_date = max(all_dates)
        days = (max_date - min_date).days
        
        if days < 30:
            return Decimal('0')
        
        # 简化计算：使用总收益率年化
        total_cost = sum(p.cost_value for p in self.positions)
        total_value = sum(p.market_value for p in self.positions)
        
        if total_cost <= 0:
            return Decimal('0')
        
        total_return = float(total_value - total_cost) / float(total_cost)
        years = days / 365.25
        
        if years <= 0:
            return Decimal('0')
        
        # 年化收益率 = (1 + 总收益率)^(1/年数) - 1
        try:
            annualized = (pow(1 + total_return, 1 / years) - 1) * 100
            return Decimal(str(annualized)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        except:
            return Decimal('0')
    
    def get_top_positions(self, n: int = 10) -> List[FundPosition]:
        """获取前N大持仓"""
        sorted_positions = sorted(self.positions, key=lambda p: p.market_value, reverse=True)
        return sorted_positions[:n]
    
    def get_loss_positions(self) -> List[FundPosition]:
        """获取亏损持仓"""
        return [p for p in self.positions if p.profit_loss < 0]
    
    def get_profit_positions(self) -> List[FundPosition]:
        """获取盈利持仓"""
        return [p for p in self.positions if p.profit_loss > 0]
    
    def get_rebalancing_suggestions(self, target_allocation: Dict[str, Decimal]) -> List[Dict]:
        """获取再平衡建议"""
        allocation = self.analyze_allocation()
        suggestions = []
        
        total_assets = allocation.total_assets
        
        for market, target_pct in target_allocation.items():
            current_pct = allocation.market_distribution.get(market, Decimal('0'))
            diff_pct = target_pct - current_pct
            diff_amount = (diff_pct / 100 * total_assets).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            
            if abs(diff_pct) >= 5:  # 差异超过5%才建议调整
                suggestions.append({
                    'market': market,
                    'current_pct': current_pct,
                    'target_pct': target_pct,
                    'diff_pct': diff_pct,
                    'diff_amount': diff_amount,
                    'action': '买入' if diff_pct > 0 else '卖出'
                })
        
        return sorted(suggestions, key=lambda x: abs(x['diff_pct']), reverse=True)


# 便捷函数
def create_position(
    code: str,
    name: str,
    shares: float,
    nav: float,
    cost_price: float,
    category: str,
    market: str = 'A股',
    industry: Optional[str] = None
) -> FundPosition:
    """创建持仓的便捷函数"""
    return FundPosition(
        code=code,
        name=name,
        shares=Decimal(str(shares)),
        nav=Decimal(str(nav)),
        cost_price=Decimal(str(cost_price)),
        category=category,
        market=market,
        industry=industry
    )