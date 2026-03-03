"""
投资建议引擎 - 基金系统核心决策模块
实现E大风格的投资建议：估值判断、仓位建议、网格策略
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum

try:
    from .valuation import ValuationMetrics, ValuationLevel, ValuationAnalyzer
except ImportError:
    from valuation import ValuationMetrics, ValuationLevel, ValuationAnalyzer


class SignalType(Enum):
    """信号类型"""
    STRONG_BUY = "强烈买入"
    BUY = "买入"
    LIGHT_BUY = "轻仓买入"
    HOLD = "持有"
    LIGHT_SELL = "轻仓卖出"
    SELL = "卖出"
    STRONG_SELL = "强烈卖出"


@dataclass
class PositionAdvice:
    """仓位建议"""
    code: str
    name: str
    
    # 当前状态
    current_position: Decimal          # 当前仓位 (%)
    target_position: Decimal           # 建议仓位 (%)
    position_diff: Decimal             # 仓位差异 (%)
    
    # 建议
    action: str                        # 操作建议
    action_reason: str                 # 建议理由
    
    # 买卖金额建议
    suggested_amount: Optional[Decimal] = None
    
    # 风险等级
    risk_level: str = "中"             # 低/中/高


@dataclass
class GridSignal:
    """网格交易信号"""
    code: str
    name: str
    
    # 网格参数
    base_price: Decimal                # 基准价格
    grid_size: Decimal                 # 网格间距 (%)
    
    # 当前信号
    current_price: Decimal
    signal: SignalType
    
    # 网格档位
    grid_level: int                    # 当前档位（0为基准，负数为下跌档位）
    
    # 交易建议
    trade_type: Optional[str] = None   # 买入/卖出/观望
    trade_price: Optional[Decimal] = None
    trade_amount: Optional[Decimal] = None


@dataclass
class InvestmentAdvice:
    """投资建议综合结果"""
    code: str
    name: str
    
    # 估值判断
    valuation_temp: Optional[Decimal]
    valuation_level: str
    
    # 仓位建议
    current_position: Decimal
    target_position: Decimal
    position_action: str
    
    # 买卖信号
    signal: SignalType
    signal_reason: str
    
    # 网格策略
    grid_signals: List[GridSignal] = None
    
    # 风险提示
    risk_warning: str = ""
    
    # 生成时间
    generated_at: datetime = None
    
    def __post_init__(self):
        if self.generated_at is None:
            self.generated_at = datetime.now()


class InvestmentAdvisor:
    """
    投资建议引擎 - E大风格
    
    E大核心策略：
    1. 估值定仓位 - 低估重仓，高估轻仓
    2. 网格交易 - 在估值区间内做波段
    3. 分散配置 - 不押注单一资产
    4. 长期持有 - 优质资产长期配置
    """
    
    # 估值温度与目标仓位映射（E大风格）
    TEMP_POSITION_MAP = {
        # 温度: (目标仓位%, 操作)
        ValuationLevel.EXTREMELY_LOW: (Decimal('100'), "满仓持有"),
        ValuationLevel.VERY_LOW: (Decimal('90'), "重仓持有"),
        ValuationLevel.LOW: (Decimal('70'), "加仓持有"),
        ValuationLevel.FAIR: (Decimal('50'), "标准仓位"),
        ValuationLevel.HIGH: (Decimal('30'), "减仓观望"),
        ValuationLevel.VERY_HIGH: (Decimal('10'), "轻仓观望"),
        ValuationLevel.EXTREMELY_HIGH: (Decimal('0'), "清仓等待"),
    }
    
    # 网格参数配置
    DEFAULT_GRID_CONFIG = {
        'grid_size': Decimal('5'),       # 默认5%一个网格
        'max_grids': 10,                 # 最大网格数
        'base_position': Decimal('50'),  # 基准仓位
    }
    
    def __init__(self, total_capital: Decimal = Decimal('1000000')):
        """
        Args:
            total_capital: 总投资金额（用于计算买卖金额）
        """
        self.total_capital = total_capital
        self.valuation_analyzer = ValuationAnalyzer()
        self.current_positions: Dict[str, Decimal] = {}  # code -> position%
    
    def set_position(self, code: str, position_pct: Decimal) -> None:
        """设置当前仓位"""
        self.current_positions[code] = position_pct
    
    def get_position_advice(
        self,
        valuation: ValuationMetrics,
        current_position: Optional[Decimal] = None
    ) -> PositionAdvice:
        """
        获取仓位建议
        
        E大仓位策略：
        - 极度低估(0-10℃): 100%仓位
        - 非常低估(10-20℃): 90%仓位
        - 低估(20-30℃): 70%仓位
        - 合理(30-70℃): 50%仓位
        - 高估(70-80℃): 30%仓位
        - 非常高估(80-90℃): 10%仓位
        - 极度高估(90-100℃): 0%仓位
        """
        code = valuation.code
        name = valuation.name
        
        # 获取当前仓位
        if current_position is None:
            current_position = self.current_positions.get(code, Decimal('0'))
        
        # 根据估值等级获取目标仓位
        if valuation.level in self.TEMP_POSITION_MAP:
            target_position, action_reason = self.TEMP_POSITION_MAP[valuation.level]
        else:
            target_position, action_reason = Decimal('50'), "保持标准仓位"
        
        # 计算仓位差异
        position_diff = target_position - current_position
        
        # 确定操作建议
        if position_diff >= 20:
            action = "大幅加仓"
        elif position_diff >= 10:
            action = "适度加仓"
        elif position_diff >= 5:
            action = "小幅加仓"
        elif position_diff <= -20:
            action = "大幅减仓"
        elif position_diff <= -10:
            action = "适度减仓"
        elif position_diff <= -5:
            action = "小幅减仓"
        else:
            action = "持仓不动"
        
        # 计算建议金额
        suggested_amount = None
        if abs(position_diff) >= 5:
            suggested_amount = (position_diff / 100 * self.total_capital).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
        
        # 风险评估
        risk_level = self._assess_risk(valuation, current_position)
        
        return PositionAdvice(
            code=code,
            name=name,
            current_position=current_position,
            target_position=target_position,
            position_diff=position_diff,
            action=action,
            action_reason=action_reason,
            suggested_amount=suggested_amount,
            risk_level=risk_level
        )
    
    def _assess_risk(
        self,
        valuation: ValuationMetrics,
        current_position: Decimal
    ) -> str:
        """风险评估"""
        if valuation.valuation_temp is None:
            return "未知"
        
        temp = valuation.valuation_temp
        
        # 高估区域高仓位 = 高风险
        if temp >= 70 and current_position >= 50:
            return "高"
        
        # 低估区域低仓位 = 低风险（机会成本）
        if temp <= 30 and current_position <= 20:
            return "低（机会成本）"
        
        # 极高估值 = 高风险
        if temp >= 90:
            return "极高"
        
        # 极低估值 = 低风险
        if temp <= 10:
            return "低"
        
        return "中"
    
    def get_trade_signal(
        self,
        valuation: ValuationMetrics,
        current_position: Optional[Decimal] = None
    ) -> Tuple[SignalType, str]:
        """
        获取买卖信号
        """
        if current_position is None:
            current_position = self.current_positions.get(valuation.code, Decimal('0'))
        
        temp = valuation.valuation_temp
        if temp is None:
            return SignalType.HOLD, "估值数据不足"
        
        # 根据估值温度和仓位综合判断
        if temp <= 10:
            if current_position < 80:
                return SignalType.STRONG_BUY, "极度低估，建议满仓"
            else:
                return SignalType.HOLD, "极度低估，已重仓持有"
        
        elif temp <= 20:
            if current_position < 70:
                return SignalType.BUY, "非常低估，建议加仓"
            else:
                return SignalType.HOLD, "非常低估，已较重仓位"
        
        elif temp <= 30:
            if current_position < 50:
                return SignalType.BUY, "低估区域，可逐步建仓"
            else:
                return SignalType.HOLD, "低估区域，持有观望"
        
        elif temp <= 40:
            return SignalType.LIGHT_BUY, "轻度低估，可小仓位买入"
        
        elif temp <= 60:
            return SignalType.HOLD, "估值合理，持有为主"
        
        elif temp <= 70:
            return SignalType.LIGHT_SELL, "轻度高估，可小幅减仓"
        
        elif temp <= 80:
            if current_position > 40:
                return SignalType.SELL, "高估区域，建议减仓"
            else:
                return SignalType.HOLD, "高估区域，已较轻仓位"
        
        elif temp <= 90:
            if current_position > 20:
                return SignalType.SELL, "非常高估，大幅减仓"
            else:
                return SignalType.HOLD, "非常高估，已轻仓"
        
        else:
            if current_position > 0:
                return SignalType.STRONG_SELL, "极度高估，清仓等待"
            else:
                return SignalType.HOLD, "极度高估，空仓等待"
    
    def calculate_grid_signals(
        self,
        code: str,
        name: str,
        current_price: Decimal,
        base_price: Decimal,
        grid_size: Decimal = None,
        current_position: Decimal = None
    ) -> List[GridSignal]:
        """
        计算网格交易信号
        
        网格策略：
        - 以基准价格为中心，上下设置网格
        - 每下跌一格买入，每上涨一格卖出
        - 适合震荡行情
        """
        if grid_size is None:
            grid_size = self.DEFAULT_GRID_CONFIG['grid_size']
        
        if current_position is None:
            current_position = self.current_positions.get(code, Decimal('50'))
        
        signals = []
        max_grids = self.DEFAULT_GRID_CONFIG['max_grids']
        
        # 计算当前档位
        price_diff = current_price - base_price
        price_pct = price_diff / base_price * 100
        current_level = int(price_pct / grid_size)
        
        # 生成各档位信号
        for level in range(-max_grids, max_grids + 1):
            level_price = base_price * (1 + level * grid_size / 100)
            
            # 确定信号类型
            if level < current_level:
                # 当前价格高于此档位，如果之前买入可考虑卖出
                signal = SignalType.SELL if level >= -2 else SignalType.HOLD
                trade_type = "卖出" if level >= -2 else None
            elif level > current_level:
                # 当前价格低于此档位，可考虑买入
                signal = SignalType.BUY if level <= 2 else SignalType.LIGHT_BUY
                trade_type = "买入" if level <= 2 else "轻仓买入"
            else:
                signal = SignalType.HOLD
                trade_type = "观望"
            
            # 计算建议金额
            trade_amount = None
            if trade_type and "买入" in trade_type:
                # 买入金额根据档位调整
                base_amount = self.total_capital / 20  # 每次投入总资金的5%
                multiplier = max(1, abs(level)) if level < 0 else 1
                trade_amount = (Decimal(str(base_amount)) * multiplier).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
            elif trade_type and "卖出" in trade_type:
                # 卖出金额根据持仓计算
                trade_amount = (current_position / 100 * self.total_capital / 10).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
            
            signals.append(GridSignal(
                code=code,
                name=name,
                base_price=base_price,
                grid_size=grid_size,
                current_price=current_price,
                signal=signal,
                grid_level=level,
                trade_type=trade_type,
                trade_price=level_price.quantize(Decimal('0.001'), rounding=ROUND_HALF_UP),
                trade_amount=trade_amount
            ))
        
        return signals
    
    def generate_advice(
        self,
        valuation: ValuationMetrics,
        current_price: Optional[Decimal] = None,
        base_price: Optional[Decimal] = None
    ) -> InvestmentAdvice:
        """
        生成综合投资建议
        """
        code = valuation.code
        name = valuation.name
        
        # 获取仓位建议
        position_advice = self.get_position_advice(valuation)
        
        # 获取买卖信号
        signal, signal_reason = self.get_trade_signal(
            valuation,
            position_advice.current_position
        )
        
        # 获取网格信号
        grid_signals = None
        if current_price is not None and base_price is not None:
            grid_signals = self.calculate_grid_signals(
                code, name, current_price, base_price,
                current_position=position_advice.current_position
            )
        
        # 风险提示
        risk_warning = self._generate_risk_warning(valuation, position_advice)
        
        return InvestmentAdvice(
            code=code,
            name=name,
            valuation_temp=valuation.valuation_temp,
            valuation_level=valuation.level_name,
            current_position=position_advice.current_position,
            target_position=position_advice.target_position,
            position_action=position_advice.action,
            signal=signal,
            signal_reason=signal_reason,
            grid_signals=grid_signals,
            risk_warning=risk_warning
        )
    
    def _generate_risk_warning(
        self,
        valuation: ValuationMetrics,
        position_advice: PositionAdvice
    ) -> str:
        """生成风险提示"""
        warnings = []
        
        if valuation.valuation_temp is None:
            return "估值数据不足，请谨慎决策"
        
        # 估值风险
        if valuation.valuation_temp >= 90:
            warnings.append("市场处于极度高估区域，注意回撤风险")
        elif valuation.valuation_temp >= 80:
            warnings.append("市场处于高估区域，建议控制仓位")
        
        # 仓位风险
        if position_advice.current_position > 80 and valuation.valuation_temp >= 70:
            warnings.append("高仓位+高估值，风险较大")
        
        # 机会成本
        if position_advice.current_position < 20 and valuation.valuation_temp <= 20:
            warnings.append("低仓位+低估值，可能错失机会")
        
        return "；".join(warnings) if warnings else "风险可控"
    
    def batch_advice(
        self,
        valuations: List[ValuationMetrics]
    ) -> List[InvestmentAdvice]:
        """批量生成投资建议"""
        return [self.generate_advice(v) for v in valuations]
    
    def get_portfolio_advice(
        self,
        valuations: List[ValuationMetrics]
    ) -> Dict:
        """
        获取组合建议
        """
        advices = self.batch_advice(valuations)
        
        # 统计
        buy_signals = [a for a in advices if a.signal in [SignalType.BUY, SignalType.STRONG_BUY]]
        sell_signals = [a for a in advices if a.signal in [SignalType.SELL, SignalType.STRONG_SELL]]
        hold_signals = [a for a in advices if a.signal == SignalType.HOLD]
        
        # 平均估值温度
        temps = [a.valuation_temp for a in advices if a.valuation_temp is not None]
        avg_temp = (sum(temps) / len(temps)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if temps else None
        
        # 目标总仓位
        target_positions = [a.target_position for a in advices]
        avg_target = (sum(target_positions) / len(target_positions)).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        ) if target_positions else Decimal('0')
        
        current_positions = [a.current_position for a in advices]
        avg_current = (sum(current_positions) / len(current_positions)).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        ) if current_positions else Decimal('0')
        
        return {
            'total_assets': len(advices),
            'buy_signals': len(buy_signals),
            'sell_signals': len(sell_signals),
            'hold_signals': len(hold_signals),
            'average_valuation_temp': avg_temp,
            'average_current_position': avg_current,
            'average_target_position': avg_target,
            'position_adjustment': (avg_target - avg_current).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            'undervalued_assets': [a.code for a in advices if a.valuation_temp is not None and a.valuation_temp <= 30],
            'overvalued_assets': [a.code for a in advices if a.valuation_temp is not None and a.valuation_temp >= 70],
            'top_buy': [{'code': a.code, 'name': a.name, 'temp': a.valuation_temp} for a in buy_signals[:3]],
            'top_sell': [{'code': a.code, 'name': a.name, 'temp': a.valuation_temp} for a in sell_signals[:3]],
        }


# 便捷函数
def quick_advice(
    temp: float,
    current_position: float = 0
) -> Dict:
    """
    快速获取建议（便捷函数）
    """
    advisor = InvestmentAdvisor()
    
    # 创建模拟估值数据
    try:
        from .valuation import ValuationLevel
    except ImportError:
        from valuation import ValuationLevel
    
    temp_decimal = Decimal(str(temp))
    
    # 根据温度确定等级
    if temp <= 10:
        level = ValuationLevel.EXTREMELY_LOW
    elif temp <= 20:
        level = ValuationLevel.VERY_LOW
    elif temp <= 30:
        level = ValuationLevel.LOW
    elif temp <= 70:
        level = ValuationLevel.FAIR
    elif temp <= 80:
        level = ValuationLevel.HIGH
    elif temp <= 90:
        level = ValuationLevel.VERY_HIGH
    else:
        level = ValuationLevel.EXTREMELY_HIGH
    
    valuation = ValuationMetrics(
        code='QUICK',
        name='快速分析',
        valuation_temp=temp_decimal,
        level=level,
        level_name=advisor.valuation_analyzer.LEVEL_NAMES.get(level, '未知')
    )
    
    advice = advisor.generate_advice(valuation)
    
    return {
        'valuation_temp': advice.valuation_temp,
        'valuation_level': advice.valuation_level,
        'signal': advice.signal.value,
        'signal_reason': advice.signal_reason,
        'target_position': advice.target_position,
        'position_action': advice.position_action,
        'risk_warning': advice.risk_warning,
    }