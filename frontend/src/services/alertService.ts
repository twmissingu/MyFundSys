import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface PendingAlert {
  id: string;
  transactionId: string;
  fundCode: string;
  confirmDate: string;
  reason: string;
  detail: string;
  status: 'unresolved' | 'resolved' | 'ignored';
  createdAt: string;
  resolvedAt: string | null;
}

export async function createAlert(alert: {
  transactionId: string;
  fundCode: string;
  confirmDate: string;
  reason: string;
  detail: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  // 修复 #2：同一笔交易、同一原因去重，避免 processPendingTransactions 反复运行时告警膨胀。
  // 依赖 pending_alerts (transaction_id, reason) 唯一约束 + upsert。
  // 若约束尚未迁移（旧库），upsert 回退为普通 insert 并忽略冲突错误。
  const row = {
    transaction_id: alert.transactionId,
    fund_code: alert.fundCode,
    confirm_date: alert.confirmDate,
    reason: alert.reason,
    detail: alert.detail,
  };
  const { error } = await (supabase.from('pending_alerts') as any).upsert(row, {
    onConflict: 'transaction_id,reason',
    ignoreDuplicates: true,
  });
  // ignoreDuplicates 下重复行不会报错；仅当 upsert 因唯一约束缺失等原因失败时，
  // 退回普通 insert（best-effort，不抛出阻塞主流程）。
  if (error) {
    try {
      await (supabase.from('pending_alerts') as any).insert(row);
    } catch (e) {
      // 修复 #11：fallback insert 失败不再完全静默，至少记录以便排查（不阻塞主流程）
      console.warn('告警 fallback insert 失败:', e);
    }
  }
}

export async function fetchAlerts(): Promise<PendingAlert[]> {
  if (!isSupabaseConfigured()) return [];
  // 修复 #8：错误不再返回 [] 掩盖（UI 无法区分"无告警"与"加载失败"），改为抛出供调用方处理
  const { data, error } = await (supabase
    .from('pending_alerts') as any)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`加载告警失败: ${error.message}`);
  return ((data as any[]) || []).map(mapDbAlert);
}

export async function resolveAlert(alertId: string, status: 'resolved' | 'ignored'): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await (supabase.from('pending_alerts') as any).update({
    status,
    resolved_at: new Date().toISOString(),
  }).eq('id', alertId);
  // 修复 #5：检查 error，避免更新失败时 UI 误移除仍未解决的告警
  if (error) throw new Error(`更新告警状态失败: ${error.message}`);
}

export async function fetchUnresolvedAlertCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  // 修复 #8：错误不再返回 0 掩盖，改为抛出供调用方处理
  const { count, error } = await (supabase
    .from('pending_alerts') as any)
    .select('id', { count: 'exact', head: true })
    .eq('status', 'unresolved');
  if (error) throw new Error(`加载告警数量失败: ${error.message}`);
  return count || 0;
}

function mapDbAlert(row: any): PendingAlert {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    fundCode: row.fund_code,
    confirmDate: row.confirm_date,
    reason: row.reason,
    detail: row.detail,
    status: row.status || 'unresolved',
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}
