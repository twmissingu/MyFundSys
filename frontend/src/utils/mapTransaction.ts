import type { Transaction } from '../types';

/**
 * 映射 Supabase transactions 表行（snake_case）到 Transaction（camelCase）。
 * 数据完整性关键函数——confirm_date 回退到 date、source 默认 manual、nav→price。
 * 被 useSync（数据访问）与 navUpdateService（超卖校验）共用，避免重复实现导致分歧。
 */
export function mapTransaction(t: any): Transaction {
  return {
    id: t.id,
    fundId: t.fund_code,
    fundCode: t.fund_code,
    fundName: t.fund_name,
    type: t.type,
    date: t.date,
    confirmDate: t.confirm_date || t.date,
    amount: t.amount,
    price: t.nav,
    shares: t.shares,
    fee: t.fee,
    status: t.status,
    source: t.source || 'manual',
    gridExecutionId: t.grid_execution_id,
    lotId: t.lot_id,
    createdAt: t.created_at,
  };
}
