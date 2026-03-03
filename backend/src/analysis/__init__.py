"""
基金系统 - 资产分析模块

本模块提供完整的资产分析、估值分析和投资建议功能

主要组件:
- analyzer: 资产分析器，计算资产配置、收益指标
- valuation: 估值分析器，计算估值温度、PE/PB百分位
- advisor: 投资建议引擎，生成E大风格的投资建议
- reporter: 报告生成器，生成每日持仓报告

使用示例:
    from src.analysis import AssetAnalyzer, ValuationAnalyzer, InvestmentAdvisor, ReportGenerator
    
    # 创建分析器
    asset_analyzer = AssetAnalyzer()
    valuation_analyzer = ValuationAnalyzer()
    advisor = InvestmentAdvisor(total_capital=1000000)
    
    # 添加持仓
    from src.analysis.analyzer import create_position
    position = create_position(
        code='000001',
        name='上证指数ETF',
        shares=10000,
        nav=3.5,
        cost_price=3.0,
        category='ETF',
        market='A股'
    )
    asset_analyzer.add_position(position)
    
    # 分析估值
    from datetime import datetime
    from decimal import Decimal
    
    pe_history = [(datetime.now() - timedelta(days=i), Decimal('12')) for i in range(365)]
    pb_history = [(datetime.now() - timedelta(days=i), Decimal('1.2')) for i in range(365)]
    
    valuation = valuation_analyzer.analyze_valuation(
        code='000001',
        name='上证指数',
        current_pe=Decimal('12.5'),
        current_pb=Decimal('1.3'),
        pe_history=pe_history,
        pb_history=pb_history
    )
    
    # 生成投资建议
    advice = advisor.generate_advice(valuation)
    print(f"估值温度: {advice.valuation_temp}℃")
    print(f"建议: {advice.signal.value}")
    
    # 生成报告
    report_generator = ReportGenerator(asset_analyzer, valuation_analyzer, advisor)
    report = report_generator.generate_daily_report()
    print(report_generator.generate_text_report(report))
"""

try:
    from .analyzer import (
        AssetAnalyzer,
        AssetAllocation,
        FundPosition,
        ReturnMetrics,
        create_position
    )

    from .valuation import (
        ValuationAnalyzer,
        ValuationMetrics,
        ValuationLevel,
        IndexValuation,
        quick_valuation
    )

    from .advisor import (
        InvestmentAdvisor,
        InvestmentAdvice,
        PositionAdvice,
        GridSignal,
        SignalType,
        quick_advice
    )

    from .reporter import (
        ReportGenerator,
        DailyReport,
        create_simple_report
    )
except ImportError:
    # 直接导入时
    from analyzer import (
        AssetAnalyzer,
        AssetAllocation,
        FundPosition,
        ReturnMetrics,
        create_position
    )

    from valuation import (
        ValuationAnalyzer,
        ValuationMetrics,
        ValuationLevel,
        IndexValuation,
        quick_valuation
    )

    from advisor import (
        InvestmentAdvisor,
        InvestmentAdvice,
        PositionAdvice,
        GridSignal,
        SignalType,
        quick_advice
    )

    from reporter import (
        ReportGenerator,
        DailyReport,
        create_simple_report
    )

__all__ = [
    # Analyzer
    'AssetAnalyzer',
    'AssetAllocation',
    'FundPosition',
    'ReturnMetrics',
    'create_position',
    
    # Valuation
    'ValuationAnalyzer',
    'ValuationMetrics',
    'ValuationLevel',
    'IndexValuation',
    'quick_valuation',
    
    # Advisor
    'InvestmentAdvisor',
    'InvestmentAdvice',
    'PositionAdvice',
    'GridSignal',
    'SignalType',
    'quick_advice',
    
    # Reporter
    'ReportGenerator',
    'DailyReport',
    'create_simple_report',
]