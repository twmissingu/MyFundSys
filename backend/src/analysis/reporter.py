"""
报告生成器 - 基金系统报告模块
生成每日持仓报告、资产配置图表、投资建议摘要
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
import json

try:
    from .analyzer import AssetAnalyzer, AssetAllocation, FundPosition, ReturnMetrics
    from .valuation import ValuationMetrics, ValuationAnalyzer
    from .advisor import InvestmentAdvisor, InvestmentAdvice
except ImportError:
    from analyzer import AssetAnalyzer, AssetAllocation, FundPosition, ReturnMetrics
    from valuation import ValuationMetrics, ValuationAnalyzer
    from advisor import InvestmentAdvisor, InvestmentAdvice


@dataclass
class DailyReport:
    """每日持仓报告"""
    report_date: date
    generated_at: datetime
    
    # 资产概况
    total_assets: Decimal
    total_cost: Decimal
    total_profit_loss: Decimal
    total_return_pct: Decimal
    
    # 分布数据
    market_distribution: Dict[str, Decimal]
    industry_distribution: Dict[str, Decimal]
    category_distribution: Dict[str, Decimal]
    
    # 持仓明细
    positions: List[FundPosition]
    
    # 估值分析
    valuations: List[ValuationMetrics]
    
    # 投资建议
    advices: List[InvestmentAdvice]
    
    # 市场温度
    market_temperature: Optional[Decimal] = None
    
    # 报告备注
    notes: str = ""


@dataclass
class ReportSection:
    """报告章节"""
    title: str
    content: str
    data: Optional[Dict] = None


class ReportGenerator:
    """报告生成器"""
    
    def __init__(
        self,
        asset_analyzer: AssetAnalyzer,
        valuation_analyzer: ValuationAnalyzer,
        advisor: InvestmentAdvisor
    ):
        self.asset_analyzer = asset_analyzer
        self.valuation_analyzer = valuation_analyzer
        self.advisor = advisor
    
    def generate_daily_report(self) -> DailyReport:
        """生成每日持仓报告"""
        # 分析资产配置
        allocation = self.asset_analyzer.analyze_allocation()
        
        # 获取所有估值数据
        valuations = self.valuation_analyzer.get_all_valuations()
        
        # 生成投资建议
        advices = self.advisor.batch_advice(valuations)
        
        # 计算市场温度
        market_temp_data = self.valuation_analyzer.get_market_temperature()
        market_temp = market_temp_data.get('average_temp')
        
        return DailyReport(
            report_date=date.today(),
            generated_at=datetime.now(),
            total_assets=allocation.total_assets,
            total_cost=allocation.total_cost,
            total_profit_loss=allocation.total_profit_loss,
            total_return_pct=allocation.total_return_pct,
            market_distribution=allocation.market_distribution,
            industry_distribution=allocation.industry_distribution,
            category_distribution=allocation.category_distribution,
            positions=allocation.positions,
            valuations=valuations,
            advices=advices,
            market_temperature=market_temp
        )
    
    def generate_text_report(self, report: DailyReport = None) -> str:
        """生成文本格式报告"""
        if report is None:
            report = self.generate_daily_report()
        
        lines = []
        
        # 报告头
        lines.append("=" * 60)
        lines.append(f"每日持仓报告 - {report.report_date}")
        lines.append("=" * 60)
        lines.append("")
        
        # 资产概况
        lines.append("【资产概况】")
        lines.append(f"总资产: ¥{report.total_assets:,.2f}")
        lines.append(f"总成本: ¥{report.total_cost:,.2f}")
        lines.append(f"总盈亏: ¥{report.total_profit_loss:,.2f} ({report.total_return_pct}%)")
        lines.append("")
        
        # 市场分布
        lines.append("【市场分布】")
        for market, pct in sorted(report.market_distribution.items(), key=lambda x: x[1], reverse=True):
            if pct > 0:
                bar = "█" * int(pct / 2)
                lines.append(f"  {market:6s}: {pct:6.2f}% {bar}")
        lines.append("")
        
        # 行业分布
        if report.industry_distribution:
            lines.append("【行业分布】")
            for industry, pct in sorted(report.industry_distribution.items(), key=lambda x: x[1], reverse=True)[:5]:
                lines.append(f"  {industry}: {pct:.2f}%")
            lines.append("")
        
        # 持仓明细
        lines.append("【持仓明细】")
        lines.append(f"{'代码':<8} {'名称':<12} {'市值':>12} {'盈亏':>10} {'盈亏%':>8}")
        lines.append("-" * 60)
        for pos in sorted(report.positions, key=lambda x: x.market_value, reverse=True):
            pl_sign = "+" if pos.profit_loss >= 0 else ""
            lines.append(
                f"{pos.code:<8} {pos.name[:10]:<12} "
                f"¥{pos.market_value:>10,.2f} "
                f"{pl_sign}¥{pos.profit_loss:>8,.2f} "
                f"{pl_sign}{pos.profit_loss_pct:>6.2f}%"
            )
        lines.append("")
        
        # 估值分析
        lines.append("【估值分析】")
        if report.market_temperature is not None:
            lines.append(f"市场整体温度: {report.market_temperature}℃")
        lines.append(f"{'指数':<10} {'名称':<12} {'温度':>6} {'估值等级':<10}")
        lines.append("-" * 50)
        for v in report.valuations[:5]:
            temp_str = f"{v.valuation_temp}℃" if v.valuation_temp else "N/A"
            lines.append(f"{v.code:<10} {v.name[:10]:<12} {temp_str:>6} {v.level_name:<10}")
        lines.append("")
        
        # 投资建议
        lines.append("【投资建议】")
        buy_advices = [a for a in report.advices if "买入" in a.signal.value]
        sell_advices = [a for a in report.advices if "卖出" in a.signal.value]
        
        if buy_advices:
            lines.append("买入机会:")
            for a in buy_advices[:3]:
                lines.append(f"  • {a.name} ({a.code}): {a.signal.value} - {a.valuation_level}")
        
        if sell_advices:
            lines.append("卖出提示:")
            for a in sell_advices[:3]:
                lines.append(f"  • {a.name} ({a.code}): {a.signal.value} - {a.valuation_level}")
        
        if not buy_advices and not sell_advices:
            lines.append("  当前以持有为主，暂无明确买卖信号")
        
        lines.append("")
        lines.append("=" * 60)
        lines.append(f"报告生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)
        
        return "\n".join(lines)
    
    def generate_markdown_report(self, report: DailyReport = None) -> str:
        """生成Markdown格式报告"""
        if report is None:
            report = self.generate_daily_report()
        
        lines = []
        
        # 报告头
        lines.append(f"# 每日持仓报告 - {report.report_date}")
        lines.append("")
        lines.append(f"> 生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 资产概况
        lines.append("## 📊 资产概况")
        lines.append("")
        lines.append(f"| 指标 | 数值 |")
        lines.append(f"|------|------|")
        lines.append(f"| 总资产 | ¥{report.total_assets:,.2f} |")
        lines.append(f"| 总成本 | ¥{report.total_cost:,.2f} |")
        
        pl_color = "🟢" if report.total_profit_loss >= 0 else "🔴"
        lines.append(f"| 总盈亏 | {pl_color} ¥{report.total_profit_loss:,.2f} ({report.total_return_pct}%) |")
        lines.append("")
        
        # 市场分布
        lines.append("## 🌍 市场分布")
        lines.append("")
        lines.append(f"| 市场 | 占比 | 可视化 |")
        lines.append(f"|------|------|--------|")
        for market, pct in sorted(report.market_distribution.items(), key=lambda x: x[1], reverse=True):
            if pct > 0:
                bar = "█" * int(pct / 5)
                lines.append(f"| {market} | {pct:.2f}% | {bar} |")
        lines.append("")
        
        # 估值温度
        lines.append("## 🌡️ 估值温度")
        lines.append("")
        if report.market_temperature is not None:
            temp = report.market_temperature
            if temp <= 20:
                temp_emoji = "🧊"
            elif temp <= 40:
                temp_emoji = "❄️"
            elif temp <= 60:
                temp_emoji = "😊"
            elif temp <= 80:
                temp_emoji = "🔥"
            else:
                temp_emoji = "🌋"
            lines.append(f"**市场整体温度: {temp}℃** {temp_emoji}")
            lines.append("")
        
        lines.append(f"| 指数 | 当前PE | 当前PB | 温度 | 等级 |")
        lines.append(f"|------|--------|--------|------|------|")
        for v in report.valuations:
            pe = f"{v.current_pe:.2f}" if v.current_pe else "N/A"
            pb = f"{v.current_pb:.2f}" if v.current_pb else "N/A"
            temp = f"{v.valuation_temp}℃" if v.valuation_temp else "N/A"
            lines.append(f"| {v.name} | {pe} | {pb} | {temp} | {v.level_name} |")
        lines.append("")
        
        # 持仓明细
        lines.append("## 💼 持仓明细")
        lines.append("")
        lines.append(f"| 代码 | 名称 | 市值 | 成本 | 盈亏 | 盈亏% |")
        lines.append(f"|------|------|------|------|------|-------|")
        for pos in sorted(report.positions, key=lambda x: x.market_value, reverse=True):
            pl_sign = "+" if pos.profit_loss >= 0 else ""
            lines.append(
                f"| {pos.code} | {pos.name} | "
                f"¥{pos.market_value:,.2f} | ¥{pos.cost_value:,.2f} | "
                f"{pl_sign}¥{pos.profit_loss:,.2f} | {pl_sign}{pos.profit_loss_pct}% |"
            )
        lines.append("")
        
        # 投资建议
        lines.append("## 💡 投资建议")
        lines.append("")
        
        buy_advices = [a for a in report.advices if "买入" in a.signal.value]
        sell_advices = [a for a in report.advices if "卖出" in a.signal.value]
        
        if buy_advices:
            lines.append("### 🟢 买入机会")
            lines.append("")
            for a in buy_advices[:5]:
                lines.append(f"- **{a.name}** ({a.code}): {a.signal.value}")
                lines.append(f"  - 估值: {a.valuation_level} ({a.valuation_temp}℃)")
                lines.append(f"  - 建议: {a.position_action}，目标仓位 {a.target_position}%")
                if a.risk_warning:
                    lines.append(f"  - ⚠️ {a.risk_warning}")
            lines.append("")
        
        if sell_advices:
            lines.append("### 🔴 卖出提示")
            lines.append("")
            for a in sell_advices[:5]:
                lines.append(f"- **{a.name}** ({a.code}): {a.signal.value}")
                lines.append(f"  - 估值: {a.valuation_level} ({a.valuation_temp}℃)")
                lines.append(f"  - 建议: {a.position_action}")
            lines.append("")
        
        if not buy_advices and not sell_advices:
            lines.append("当前以持有为主，暂无明确买卖信号。")
            lines.append("")
        
        # 风险提示
        lines.append("---")
        lines.append("")
        lines.append("**免责声明**: 本报告仅供参考，不构成投资建议。投资有风险，入市需谨慎。")
        
        return "\n".join(lines)
    
    def generate_json_report(self, report: DailyReport = None) -> str:
        """生成JSON格式报告"""
        if report is None:
            report = self.generate_daily_report()
        
        data = {
            'report_date': report.report_date.isoformat(),
            'generated_at': report.generated_at.isoformat(),
            'summary': {
                'total_assets': str(report.total_assets),
                'total_cost': str(report.total_cost),
                'total_profit_loss': str(report.total_profit_loss),
                'total_return_pct': str(report.total_return_pct),
                'market_temperature': str(report.market_temperature) if report.market_temperature else None,
            },
            'distribution': {
                'market': {k: str(v) for k, v in report.market_distribution.items()},
                'industry': {k: str(v) for k, v in report.industry_distribution.items()},
                'category': {k: str(v) for k, v in report.category_distribution.items()},
            },
            'positions': [
                {
                    'code': p.code,
                    'name': p.name,
                    'shares': str(p.shares),
                    'nav': str(p.nav),
                    'market_value': str(p.market_value),
                    'cost_value': str(p.cost_value),
                    'profit_loss': str(p.profit_loss),
                    'profit_loss_pct': str(p.profit_loss_pct),
                    'category': p.category,
                    'market': p.market,
                }
                for p in report.positions
            ],
            'valuations': [
                {
                    'code': v.code,
                    'name': v.name,
                    'current_pe': str(v.current_pe) if v.current_pe else None,
                    'current_pb': str(v.current_pb) if v.current_pb else None,
                    'valuation_temp': str(v.valuation_temp) if v.valuation_temp else None,
                    'level': v.level_name,
                }
                for v in report.valuations
            ],
            'advices': [
                {
                    'code': a.code,
                    'name': a.name,
                    'signal': a.signal.value,
                    'signal_reason': a.signal_reason,
                    'valuation_temp': str(a.valuation_temp) if a.valuation_temp else None,
                    'valuation_level': a.valuation_level,
                    'target_position': str(a.target_position),
                    'position_action': a.position_action,
                    'risk_warning': a.risk_warning,
                }
                for a in report.advices
            ],
        }
        
        return json.dumps(data, ensure_ascii=False, indent=2)
    
    def generate_summary(self, report: DailyReport = None) -> str:
        """生成投资建议摘要（适合推送）"""
        if report is None:
            report = self.generate_daily_report()
        
        lines = []
        
        # 标题
        lines.append(f"📊 {report.report_date} 投资日报")
        lines.append("")
        
        # 资产概况
        pl_emoji = "📈" if report.total_profit_loss >= 0 else "📉"
        lines.append(f"💰 总资产: ¥{report.total_assets:,.0f}")
        lines.append(f"{pl_emoji} 总盈亏: ¥{report.total_profit_loss:,.0f} ({report.total_return_pct}%)")
        lines.append("")
        
        # 市场温度
        if report.market_temperature is not None:
            temp = report.market_temperature
            if temp <= 20:
                temp_text = "🧊 极度低估"
            elif temp <= 40:
                temp_text = "❄️ 低估"
            elif temp <= 60:
                temp_text = "😊 合理"
            elif temp <= 80:
                temp_text = "🔥 高估"
            else:
                temp_text = "🌋 极度高估"
            lines.append(f"🌡️ 市场温度: {temp}℃ {temp_text}")
            lines.append("")
        
        # 买卖信号
        buy_advices = [a for a in report.advices if "买入" in a.signal.value]
        sell_advices = [a for a in report.advices if "卖出" in a.signal.value]
        
        if buy_advices:
            lines.append("🟢 买入机会:")
            for a in buy_advices[:3]:
                lines.append(f"  • {a.name}: {a.valuation_level}")
            lines.append("")
        
        if sell_advices:
            lines.append("🔴 卖出提示:")
            for a in sell_advices[:3]:
                lines.append(f"  • {a.name}: {a.valuation_level}")
            lines.append("")
        
        # 操作建议
        portfolio_advice = self.advisor.get_portfolio_advice(report.valuations)
        if portfolio_advice['position_adjustment'] > 5:
            lines.append(f"💡 建议: 整体加仓 {portfolio_advice['position_adjustment']:.0f}%")
        elif portfolio_advice['position_adjustment'] < -5:
            lines.append(f"💡 建议: 整体减仓 {abs(portfolio_advice['position_adjustment']):.0f}%")
        else:
            lines.append("💡 建议: 持仓观望")
        
        return "\n".join(lines)
    
    def generate_allocation_chart_data(self, report: DailyReport = None) -> Dict:
        """生成资产配置图表数据"""
        if report is None:
            report = self.generate_daily_report()
        
        # 市场分布饼图数据
        market_pie = [
            {'name': k, 'value': float(v)}
            for k, v in report.market_distribution.items() if v > 0
        ]
        
        # 行业分布数据
        industry_bar = [
            {'name': k, 'value': float(v)}
            for k, v in sorted(report.industry_distribution.items(), key=lambda x: x[1], reverse=True)[:10]
        ]
        
        # 估值温度仪表盘数据
        temp_gauge = []
        for v in report.valuations:
            if v.valuation_temp is not None:
                temp_gauge.append({
                    'name': v.name,
                    'value': float(v.valuation_temp),
                    'level': v.level_name,
                })
        
        # 持仓收益柱状图
        position_bar = [
            {
                'name': p.name[:8],
                'value': float(p.profit_loss_pct),
                'market_value': float(p.market_value),
            }
            for p in sorted(report.positions, key=lambda x: x.market_value, reverse=True)[:10]
        ]
        
        return {
            'market_pie': market_pie,
            'industry_bar': industry_bar,
            'temp_gauge': temp_gauge,
            'position_bar': position_bar,
        }
    
    def export_report(
        self,
        report: DailyReport,
        filepath: str,
        format: str = 'txt'
    ) -> bool:
        """导出报告到文件"""
        try:
            if format == 'txt':
                content = self.generate_text_report(report)
            elif format == 'md':
                content = self.generate_markdown_report(report)
            elif format == 'json':
                content = self.generate_json_report(report)
            else:
                return False
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            return True
        except Exception as e:
            print(f"导出报告失败: {e}")
            return False


# 便捷函数
def create_simple_report(
    positions: List[Dict],
    valuations: List[Dict]
) -> str:
    """
    创建简单报告（便捷函数）
    
    positions: [
        {'code': '000001', 'name': '基金A', 'shares': 1000, 'nav': 1.5, 'cost_price': 1.2, 'category': '股票型'},
        ...
    ]
    valuations: [
        {'code': '000001', 'name': '基金A', 'current_pe': 15, 'current_pb': 1.5, 'pe_history': [...], 'pb_history': [...]},
        ...
    ]
    """
    try:
        from .analyzer import create_position
    except ImportError:
        from analyzer import create_position
    
    from decimal import Decimal
    
    # 创建分析器
    asset_analyzer = AssetAnalyzer()
    valuation_analyzer = ValuationAnalyzer()
    
    # 添加持仓
    for p in positions:
        pos = create_position(
            code=p['code'],
            name=p['name'],
            shares=p['shares'],
            nav=p['nav'],
            cost_price=p['cost_price'],
            category=p['category'],
            market=p.get('market', 'A股'),
            industry=p.get('industry')
        )
        asset_analyzer.add_position(pos)
    
    # 分析估值
    for v in valuations:
        pe_history = [(datetime.now(), Decimal(str(h))) for h in v.get('pe_history', [])]
        pb_history = [(datetime.now(), Decimal(str(h))) for h in v.get('pb_history', [])]
        
        valuation_analyzer.analyze_valuation(
            code=v['code'],
            name=v['name'],
            current_pe=Decimal(str(v['current_pe'])) if v.get('current_pe') else None,
            current_pb=Decimal(str(v['current_pb'])) if v.get('current_pb') else None,
            pe_history=pe_history,
            pb_history=pb_history
        )
    
    # 创建顾问和生成器
    advisor = InvestmentAdvisor()
    generator = ReportGenerator(asset_analyzer, valuation_analyzer, advisor)
    
    # 生成报告
    return generator.generate_text_report()