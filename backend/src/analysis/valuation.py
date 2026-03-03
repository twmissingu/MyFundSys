"""
估值分析器 - 基金系统估值模块
负责计算估值温度、PE/PB百分位等估值指标
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
import statistics


class ValuationLevel(Enum):
    """估值等级 - 7级估值体系"""
    EXTREMELY_LOW = 1      # 极度低估
    VERY_LOW = 2           # 非常低估
    LOW = 3                # 低估
    FAIR = 4               # 合理
    HIGH = 5               # 高估
    VERY_HIGH = 6          # 非常高估
    EXTREMELY_HIGH = 7     # 极度高估


@dataclass
class ValuationMetrics:
    """估值指标"""
    code: str                          # 指数/基金代码
    name: str                          # 名称
    
    # 当前估值
    current_pe: Optional[Decimal] = None
    current_pb: Optional[Decimal] = None
    current_ps: Optional[Decimal] = None
    current_dy: Optional[Decimal] = None  # 股息率
    
    # 历史百分位
    pe_percentile: Optional[Decimal] = None
    pb_percentile: Optional[Decimal] = None
    ps_percentile: Optional[Decimal] = None
    
    # 估值温度
    valuation_temp: Optional[Decimal] = None
    
    # 估值等级
    level: Optional[ValuationLevel] = None
    level_name: str = "未知"
    
    # 历史数据
    pe_history: List[Tuple[datetime, Decimal]] = field(default_factory=list)
    pb_history: List[Tuple[datetime, Decimal]] = field(default_factory=list)
    
    # 统计值
    pe_min: Optional[Decimal] = None
    pe_max: Optional[Decimal] = None
    pe_median: Optional[Decimal] = None
    pb_min: Optional[Decimal] = None
    pb_max: Optional[Decimal] = None
    pb_median: Optional[Decimal] = None
    
    # 数据日期
    update_time: Optional[datetime] = None


@dataclass
class IndexValuation:
    """指数估值数据"""
    index_code: str
    index_name: str
    pe_ttm: Decimal
    pb: Decimal
    ps: Optional[Decimal] = None
    dividend_yield: Optional[Decimal] = None
    roe: Optional[Decimal] = None
    
    # 历史分位
    pe_percentile_5y: Optional[Decimal] = None
    pe_percentile_10y: Optional[Decimal] = None
    pb_percentile_5y: Optional[Decimal] = None
    pb_percentile_10y: Optional[Decimal] = None


class ValuationAnalyzer:
    """估值分析器"""
    
    # 估值等级阈值（温度）
    TEMP_THRESHOLDS = {
        ValuationLevel.EXTREMELY_LOW: (Decimal('0'), Decimal('10')),
        ValuationLevel.VERY_LOW: (Decimal('10'), Decimal('20')),
        ValuationLevel.LOW: (Decimal('20'), Decimal('30')),
        ValuationLevel.FAIR: (Decimal('30'), Decimal('70')),
        ValuationLevel.HIGH: (Decimal('70'), Decimal('80')),
        ValuationLevel.VERY_HIGH: (Decimal('80'), Decimal('90')),
        ValuationLevel.EXTREMELY_HIGH: (Decimal('90'), Decimal('100')),
    }
    
    # 等级名称映射
    LEVEL_NAMES = {
        ValuationLevel.EXTREMELY_LOW: "极度低估",
        ValuationLevel.VERY_LOW: "非常低估",
        ValuationLevel.LOW: "低估",
        ValuationLevel.FAIR: "合理估值",
        ValuationLevel.HIGH: "高估",
        ValuationLevel.VERY_HIGH: "非常高估",
        ValuationLevel.EXTREMELY_HIGH: "极度高估",
    }
    
    # 权重配置（E大风格：PE 60%, PB 40%）
    PE_WEIGHT = Decimal('0.6')
    PB_WEIGHT = Decimal('0.4')
    
    def __init__(self):
        self.valuation_cache: Dict[str, ValuationMetrics] = {}
        self.index_data: Dict[str, IndexValuation] = {}
    
    def calculate_valuation_temp(
        self,
        pe_percentile: Optional[Decimal],
        pb_percentile: Optional[Decimal]
    ) -> Optional[Decimal]:
        """
        计算估值温度
        公式：估值温度 = PE百分位 × 0.6 + PB百分位 × 0.4
        """
        if pe_percentile is None and pb_percentile is None:
            return None
        
        if pe_percentile is None:
            return pb_percentile
        
        if pb_percentile is None:
            return pe_percentile
        
        temp = (pe_percentile * self.PE_WEIGHT + pb_percentile * self.PB_WEIGHT).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        
        return temp
    
    def get_valuation_level(self, temp: Optional[Decimal]) -> Tuple[Optional[ValuationLevel], str]:
        """
        根据估值温度获取估值等级
        """
        if temp is None:
            return None, "未知"
        
        for level, (low, high) in self.TEMP_THRESHOLDS.items():
            if low <= temp <= high:
                return level, self.LEVEL_NAMES[level]
        
        return None, "未知"
    
    def calculate_percentile(
        self,
        current_value: Decimal,
        history: List[Decimal]
    ) -> Decimal:
        """
        计算历史百分位
        百分位 = (小于当前值的数据个数 / 总数据个数) × 100
        """
        if not history or current_value is None:
            return Decimal('0')
        
        sorted_history = sorted(history)
        n = len(sorted_history)
        
        # 找到当前值在排序后的位置
        count_less = sum(1 for h in sorted_history if h < current_value)
        
        percentile = (Decimal(count_less) / Decimal(n) * 100).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        
        return percentile
    
    def analyze_valuation(
        self,
        code: str,
        name: str,
        current_pe: Optional[Decimal],
        current_pb: Optional[Decimal],
        pe_history: List[Tuple[datetime, Decimal]],
        pb_history: List[Tuple[datetime, Decimal]],
        current_ps: Optional[Decimal] = None,
        current_dy: Optional[Decimal] = None
    ) -> ValuationMetrics:
        """
        分析估值
        """
        # 提取历史数值
        pe_values = [h[1] for h in pe_history]
        pb_values = [h[1] for h in pb_history]
        
        # 计算百分位
        pe_percentile = None
        pb_percentile = None
        
        if current_pe is not None and pe_values:
            pe_percentile = self.calculate_percentile(current_pe, pe_values)
        
        if current_pb is not None and pb_values:
            pb_percentile = self.calculate_percentile(current_pb, pb_values)
        
        # 计算估值温度
        temp = self.calculate_valuation_temp(pe_percentile, pb_percentile)
        
        # 获取估值等级
        level, level_name = self.get_valuation_level(temp)
        
        # 计算统计值
        pe_min = min(pe_values) if pe_values else None
        pe_max = max(pe_values) if pe_values else None
        pe_median = Decimal(str(statistics.median(pe_values))) if pe_values else None
        
        pb_min = min(pb_values) if pb_values else None
        pb_max = max(pb_values) if pb_values else None
        pb_median = Decimal(str(statistics.median(pb_values))) if pb_values else None
        
        metrics = ValuationMetrics(
            code=code,
            name=name,
            current_pe=current_pe,
            current_pb=current_pb,
            current_ps=current_ps,
            current_dy=current_dy,
            pe_percentile=pe_percentile,
            pb_percentile=pb_percentile,
            valuation_temp=temp,
            level=level,
            level_name=level_name,
            pe_history=pe_history,
            pb_history=pb_history,
            pe_min=pe_min,
            pe_max=pe_max,
            pe_median=pe_median,
            pb_min=pb_min,
            pb_max=pb_max,
            pb_median=pb_median,
            update_time=datetime.now()
        )
        
        # 缓存结果
        self.valuation_cache[code] = metrics
        
        return metrics
    
    def get_valuation(self, code: str) -> Optional[ValuationMetrics]:
        """获取估值数据"""
        return self.valuation_cache.get(code)
    
    def get_all_valuations(self) -> List[ValuationMetrics]:
        """获取所有估值数据"""
        return list(self.valuation_cache.values())
    
    def get_undervalued(self, temp_threshold: Decimal = Decimal('30')) -> List[ValuationMetrics]:
        """获取低估的资产（温度低于阈值）"""
        result = []
        for metrics in self.valuation_cache.values():
            if metrics.valuation_temp is not None and metrics.valuation_temp <= temp_threshold:
                result.append(metrics)
        return sorted(result, key=lambda x: x.valuation_temp or Decimal('999'))
    
    def get_overvalued(self, temp_threshold: Decimal = Decimal('70')) -> List[ValuationMetrics]:
        """获取高估的资产（温度高于阈值）"""
        result = []
        for metrics in self.valuation_cache.values():
            if metrics.valuation_temp is not None and metrics.valuation_temp >= temp_threshold:
                result.append(metrics)
        return sorted(result, key=lambda x: x.valuation_temp or Decimal('0'), reverse=True)
    
    def compare_valuation(
        self,
        code: str,
        years: int = 5
    ) -> Dict:
        """
        对比历史估值
        """
        metrics = self.valuation_cache.get(code)
        if not metrics:
            return {}
        
        cutoff_date = datetime.now() - timedelta(days=years * 365)
        
        # 过滤历史数据
        recent_pe = [(d, v) for d, v in metrics.pe_history if d >= cutoff_date]
        recent_pb = [(d, v) for d, v in metrics.pb_history if d >= cutoff_date]
        
        pe_values = [v for _, v in recent_pe]
        pb_values = [v for _, v in recent_pb]
        
        return {
            'code': code,
            'name': metrics.name,
            'period_years': years,
            'current_pe': metrics.current_pe,
            'current_pb': metrics.current_pb,
            'pe_stats': {
                'min': min(pe_values) if pe_values else None,
                'max': max(pe_values) if pe_values else None,
                'mean': Decimal(str(statistics.mean(pe_values))) if pe_values else None,
                'median': Decimal(str(statistics.median(pe_values))) if pe_values else None,
            },
            'pb_stats': {
                'min': min(pb_values) if pb_values else None,
                'max': max(pb_values) if pb_values else None,
                'mean': Decimal(str(statistics.mean(pb_values))) if pb_values else None,
                'median': Decimal(str(statistics.median(pb_values))) if pb_values else None,
            },
            'vs_history': {
                'pe_vs_min': ((metrics.current_pe - min(pe_values)) / min(pe_values) * 100).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                ) if pe_values and min(pe_values) > 0 else None,
                'pe_vs_max': ((metrics.current_pe - max(pe_values)) / max(pe_values) * 100).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                ) if pe_values and max(pe_values) > 0 else None,
            }
        }
    
    def batch_analyze(
        self,
        data_list: List[Dict]
    ) -> List[ValuationMetrics]:
        """
        批量分析估值
        
        data_list: [
            {
                'code': '000001',
                'name': '上证指数',
                'current_pe': Decimal('12.5'),
                'current_pb': Decimal('1.2'),
                'pe_history': [(datetime, Decimal), ...],
                'pb_history': [(datetime, Decimal), ...],
            },
            ...
        ]
        """
        results = []
        for data in data_list:
            metrics = self.analyze_valuation(
                code=data['code'],
                name=data['name'],
                current_pe=data.get('current_pe'),
                current_pb=data.get('current_pb'),
                pe_history=data.get('pe_history', []),
                pb_history=data.get('pb_history', []),
                current_ps=data.get('current_ps'),
                current_dy=data.get('current_dy')
            )
            results.append(metrics)
        
        return results
    
    def get_market_temperature(self) -> Dict:
        """
        获取市场整体温度
        """
        if not self.valuation_cache:
            return {'average_temp': None, 'status': '无数据'}
        
        temps = [m.valuation_temp for m in self.valuation_cache.values() if m.valuation_temp is not None]
        
        if not temps:
            return {'average_temp': None, 'status': '无数据'}
        
        avg_temp = (sum(temps) / len(temps)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        _, level_name = self.get_valuation_level(avg_temp)
        
        # 统计各等级数量
        level_counts = {}
        for m in self.valuation_cache.values():
            if m.level:
                level_counts[m.level_name] = level_counts.get(m.level_name, 0) + 1
        
        return {
            'average_temp': avg_temp,
            'status': level_name,
            'min_temp': min(temps),
            'max_temp': max(temps),
            'level_distribution': level_counts,
            'undervalued_count': len(self.get_undervalued()),
            'overvalued_count': len(self.get_overvalued()),
        }


# 常用指数估值基准数据（示例数据，实际应从API获取）
INDEX_BENCHMARKS = {
    '000001': {'name': '上证指数', 'pe_low': 8, 'pe_high': 30, 'pb_low': 1.0, 'pb_high': 3.0},
    '000300': {'name': '沪深300', 'pe_low': 8, 'pe_high': 25, 'pb_low': 1.0, 'pb_high': 2.5},
    '000905': {'name': '中证500', 'pe_low': 15, 'pe_high': 60, 'pb_low': 1.2, 'pb_high': 3.5},
    '399006': {'name': '创业板指', 'pe_low': 25, 'pe_high': 80, 'pb_low': 2.5, 'pb_high': 8.0},
    'HSI': {'name': '恒生指数', 'pe_low': 7, 'pe_high': 20, 'pb_low': 0.8, 'pb_high': 2.5},
    'SPX': {'name': '标普500', 'pe_low': 12, 'pe_high': 30, 'pb_low': 1.5, 'pb_high': 4.0},
    'IXIC': {'name': '纳斯达克', 'pe_low': 20, 'pe_high': 60, 'pb_low': 2.5, 'pb_high': 6.0},
}


def quick_valuation(
    current_pe: float,
    current_pb: float,
    pe_history: List[float],
    pb_history: List[float]
) -> Dict:
    """
    快速估值分析（便捷函数）
    """
    analyzer = ValuationAnalyzer()
    
    pe_decimals = [Decimal(str(v)) for v in pe_history]
    pb_decimals = [Decimal(str(v)) for v in pb_history]
    
    pe_hist = [(datetime.now() - timedelta(days=i), v) for i, v in enumerate(reversed(pe_decimals))]
    pb_hist = [(datetime.now() - timedelta(days=i), v) for i, v in enumerate(reversed(pb_decimals))]
    
    metrics = analyzer.analyze_valuation(
        code='QUICK',
        name='快速分析',
        current_pe=Decimal(str(current_pe)),
        current_pb=Decimal(str(current_pb)),
        pe_history=pe_hist,
        pb_history=pb_hist
    )
    
    return {
        'valuation_temp': metrics.valuation_temp,
        'level': metrics.level_name,
        'pe_percentile': metrics.pe_percentile,
        'pb_percentile': metrics.pb_percentile,
    }