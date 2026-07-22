import React, { useState, useEffect, useRef } from 'react';
import { Dialog, Button, Form, Input, SearchBar, SpinLoading, Toast } from 'antd-mobile';
import type { FundSearchResult, Transaction } from '../types';
import { searchFunds, fetchFundNav, fetchFundHistory } from '../services/fundApi';
import { addTransactionWithHoldingUpdate, getFundAvailableShares } from '../services/navUpdateService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isTradeDay, getNextTradeDay } from '../utils';
import { formatLocalDate } from '../utils/csv';

interface AddTransactionDialogProps {
  visible: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onTransactionAdded: () => Promise<void>;
}

const AddTransactionDialog: React.FC<AddTransactionDialogProps> = ({
  visible,
  onClose,
  transactions,
  onTransactionAdded,
}) => {
  const [form] = Form.useForm();
  const [dialogDate, setDialogDate] = useState<string>(formatLocalDate(new Date()));

  const [codeSearchText, setCodeSearchText] = useState('');
  const [codeSearchResults, setCodeSearchResults] = useState<FundSearchResult[]>([]);
  const [isCodeSearching, setIsCodeSearching] = useState(false);
  const [selectedFund, setSelectedFund] = useState<FundSearchResult | null>(null);

  const [currentTradeType, setCurrentTradeType] = useState<'buy' | 'sell'>('buy');
  const [currentNav, setCurrentNav] = useState<number | null>(null);
  const [selectedDateNav, setSelectedDateNav] = useState<{ nav: number; date: string } | null>(null);
  const [isDateNavLoading, setIsDateNavLoading] = useState(false);
  const [isPendingNav, setIsPendingNav] = useState(false);
  const navLoadedRef = useRef<string | false>(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (codeSearchText.trim().length >= 4) {
        setIsCodeSearching(true);
        try {
          const results = await searchFunds(codeSearchText.trim(), 'code');
          setCodeSearchResults(results);
        } catch {
          // 静默忽略搜索错误
        } finally {
          setIsCodeSearching(false);
        }
      } else {
        setCodeSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [codeSearchText]);

  const handleSelectFund = (fund: FundSearchResult) => {
    navLoadedRef.current = false;
    setSelectedFund(fund);
    setCodeSearchText(fund.code);
    setCodeSearchResults([]);
    form.setFieldsValue({ fundCode: fund.code });
  };

  const resetSearch = () => {
    setCodeSearchText('');
    setCodeSearchResults([]);
    setSelectedFund(null);
    setCurrentNav(null);
    setSelectedDateNav(null);
    setIsPendingNav(false);
    form.setFieldsValue({ fundCode: undefined, amount: undefined, shares: undefined, fee: undefined });
  };

  const handleTradeTypeChange = (type: 'buy' | 'sell') => {
    setCurrentTradeType(type);
    form.setFieldsValue({ type });
    form.setFieldsValue({ amount: undefined, shares: undefined, fee: undefined });
  };

  useEffect(() => {
    const fetchNav = async () => {
      if (selectedFund?.code) {
        try {
          const navData = await fetchFundNav(selectedFund.code);
          if (navData) setCurrentNav(navData.nav);
        } catch {
          // 静默忽略净值获取错误
        }
      }
    };
    fetchNav();
  }, [selectedFund]);

  useEffect(() => {
    if (!dialogDate || !selectedFund?.code) {
      setSelectedDateNav(null);
      return;
    }

    let cancelled = false;

    const fetchDateNav = async () => {
      navLoadedRef.current = false;
      const today = formatLocalDate(new Date());

      if (dialogDate >= today) {
        setIsPendingNav(true);
        setSelectedDateNav(null);
        return;
      }

      setIsDateNavLoading(true);
      try {
        let historyData = await fetchFundHistory(selectedFund.code, 1, 1, dialogDate, dialogDate);
        if (cancelled) return;

        if (historyData.length > 0) {
          setIsPendingNav(false);
          setSelectedDateNav({ nav: historyData[0].nav, date: historyData[0].date });
        } else {
          const nextData = await fetchFundHistory(selectedFund.code, 5, 1, dialogDate, '');
          if (cancelled) return;

          if (nextData.length > 0) {
            const nextRecord = nextData[nextData.length - 1];
            if (nextRecord.date >= dialogDate) {
              setIsPendingNav(false);
              setSelectedDateNav({ nav: nextRecord.nav, date: nextRecord.date });
            } else {
              setIsPendingNav(true);
              setSelectedDateNav(null);
            }
          } else {
            setIsPendingNav(true);
            setSelectedDateNav(null);
          }
        }
      } catch {
        if (cancelled) return;
        setIsPendingNav(true);
        setSelectedDateNav(null);
      } finally {
        if (!cancelled) setIsDateNavLoading(false);
      }
    };

    fetchDateNav();
    return () => { cancelled = true; };
  }, [dialogDate, selectedFund?.code, currentNav]);

  useEffect(() => {
    if (isPendingNav) {
      form.setFieldsValue({ shares: undefined, amount: undefined });
      navLoadedRef.current = false;
      return;
    }

    const nav = selectedDateNav?.nav || currentNav;
    if (!nav) return;

    if (navLoadedRef.current) {
      if (selectedDateNav && navLoadedRef.current !== 'selected') {
        navLoadedRef.current = 'selected';
      } else {
        return;
      }
    } else {
      navLoadedRef.current = currentNav ? 'current' : 'selected';
    }

    const amount = parseFloat(form.getFieldValue('amount') || '0');
    const shares = parseFloat(form.getFieldValue('shares') || '0');

    if (currentTradeType === 'buy' && amount > 0) {
      const newShares = amount / nav;
      form.setFieldsValue({ shares: newShares.toFixed(2) });
    } else if (currentTradeType === 'sell' && shares > 0) {
      const newAmount = shares * nav;
      form.setFieldsValue({ amount: newAmount.toFixed(2) });
    }
  }, [selectedDateNav, currentNav, currentTradeType, form, isPendingNav]);

  const handleAddTransaction = async (values: any) => {
    try {
      if (!selectedFund) {
        Toast.show({ content: '请先选择基金', position: 'bottom' });
        return;
      }

      if (isSupabaseConfigured()) {
        try {
          const { data: existing, error: favErr } = await supabase
            .from('favorite_funds')
            .select('id')
            .eq('fund_code', selectedFund.code)
            .limit(1)
            .maybeSingle();
          if (favErr) throw favErr;
          if (!existing) {
            const { error: insertErr } = await supabase.from('favorite_funds').insert({
              fund_code: selectedFund.code,
              fund_name: selectedFund.name,
              category: selectedFund.type,
            } as any);
            if (insertErr) throw insertErr;
          }
        } catch (e) {
          console.warn('自动收藏失败:', e);
        }
      }

      const tradeDate = new Date(values.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      tradeDate.setHours(0, 0, 0, 0);
      const actualTradeDay = isTradeDay(tradeDate) ? tradeDate : getNextTradeDay(tradeDate);

      let tradePrice: number | null = null;
      let isPending = false;

      if (selectedDateNav && selectedDateNav.date === values.date) {
        tradePrice = selectedDateNav.nav;
      }

      if (!tradePrice) {
        if (actualTradeDay >= today) {
          isPending = true;
        } else {
          try {
            let historyData = await fetchFundHistory(selectedFund.code, 1, 1, values.date, values.date);
            if (historyData.length > 0) {
              tradePrice = historyData[0].nav;
            } else {
              const nextData = await fetchFundHistory(selectedFund.code, 5, 1, values.date, '');
              if (nextData.length > 0) {
                const nextRecord = nextData[nextData.length - 1];
                if (nextRecord.date >= values.date) {
                  tradePrice = nextRecord.nav;
                }
              }
            }
          } catch {
            // 静默忽略历史净值获取错误
          }
        }
      }

      if (!tradePrice || tradePrice <= 0) {
        isPending = true;
      }

      const confirmDate = formatLocalDate(actualTradeDay);

      let shares: number;
      let amount: number;
      let finalPrice: number;

      if (values.type === 'buy') {
        amount = Number(values.amount);
        shares = isPending ? 0 : amount / (tradePrice || 1);
        finalPrice = isPending ? 0 : (tradePrice || 0);
      } else {
        shares = Number(values.shares);
        amount = shares * (tradePrice || 0);
        finalPrice = isPending ? 0 : (tradePrice || 0);
      }

      if (values.type === 'sell' && !isPending) {
        const available = getFundAvailableShares(transactions, selectedFund.code);
        if (shares > available + 1e-4) {
          Toast.show({ content: `卖出份额超过当前持仓（可用 ${available.toFixed(2)} 份）`, position: 'bottom' });
          return;
        }
      }

      await addTransactionWithHoldingUpdate({
        fundId: selectedFund.code,
        fundCode: selectedFund.code,
        fundName: selectedFund.name,
        type: values.type,
        date: values.date,
        confirmDate: confirmDate,
        amount: amount,
        price: finalPrice,
        shares: shares,
        fee: 0,
        status: isPending ? 'pending' : 'completed',
      });

      if (isPending) {
        Toast.show({ content: '已创建在途交易，净值更新后将自动处理', position: 'bottom' });
      } else {
        Toast.show({ content: `添加成功，${values.type === 'buy' ? '买入' : '卖出'}${shares.toFixed(2)}份`, position: 'bottom' });
      }

      onClose();
      resetSearch();
      form.resetFields();
      setCurrentTradeType('buy');
      await onTransactionAdded();
    } catch {
      Toast.show({ content: '添加失败', position: 'bottom' });
    }
  };

  return (
    <Dialog
      visible={visible}
      title="添加交易"
      style={{ '--max-width': '95vw' }}
      bodyStyle={{ maxHeight: '80vh', overflowY: 'auto', padding: '16px 20px' }}
      onClose={() => {
        onClose();
        resetSearch();
        form.resetFields();
      }}
      content={
        <Form form={form} layout="vertical" onFinish={handleAddTransaction}>
          <Form.Item
            name="fundCode"
            label="基金代码"
            rules={[{ required: true, message: '请选择基金' }]}
            style={{ marginBottom: 8 }}
          >
            <div>
              {selectedFund ? (
                <div style={{ padding: '8px 12px', background: '#f0f7ff', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{selectedFund.name}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{selectedFund.code}</div>
                  </div>
                  <Button size="small" onClick={resetSearch}>更换</Button>
                </div>
              ) : (
                <>
                  <SearchBar placeholder="输入基金代码（如：000001）" value={codeSearchText} onChange={setCodeSearchText} style={{ '--background': '#f5f5f5' }} />
                  {isCodeSearching && <div style={{ textAlign: 'center', padding: '8px' }}><SpinLoading style={{ '--size': '16px' }} /></div>}
                  {!isCodeSearching && codeSearchResults.length > 0 && (
                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: '4px', marginTop: '4px' }}>
                      {codeSearchResults.filter((fund, index, self) => index === self.findIndex(f => f.code === fund.code)).map((fund) => (
                        <div key={fund.code} onClick={() => handleSelectFund(fund)} style={{ padding: '8px 12px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }}>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{fund.name}</div>
                          <div style={{ fontSize: 12, color: '#999' }}>{fund.code}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!isCodeSearching && codeSearchText.length >= 4 && codeSearchResults.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '8px', color: '#999', fontSize: 12 }}>未找到匹配代码的基金</div>
                  )}
                  {!isCodeSearching && codeSearchText.length >= 2 && codeSearchText.length < 4 && (
                    <div style={{ textAlign: 'center', padding: '4px', color: '#999', fontSize: 11 }}>继续输入以获得更准确的结果...</div>
                  )}
                </>
              )}
            </div>
          </Form.Item>

          <Form.Item name="type" label="交易类型" rules={[{ required: true }]} initialValue="buy">
            <div style={{ display: 'flex', gap: 12 }}>
              <div onClick={() => handleTradeTypeChange('buy')} style={{
                flex: 1, padding: '10px 16px', textAlign: 'center', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 500, transition: 'all 0.2s',
                border: currentTradeType === 'buy' ? '2px solid #1677ff' : '1px solid #d9d9d9',
                backgroundColor: currentTradeType === 'buy' ? '#e6f4ff' : '#fff',
                color: currentTradeType === 'buy' ? '#1677ff' : '#666',
              }}>买入</div>
              <div onClick={() => handleTradeTypeChange('sell')} style={{
                flex: 1, padding: '10px 16px', textAlign: 'center', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 500, transition: 'all 0.2s',
                border: currentTradeType === 'sell' ? '2px solid #ff4d4f' : '1px solid #d9d9d9',
                backgroundColor: currentTradeType === 'sell' ? '#fff1f0' : '#fff',
                color: currentTradeType === 'sell' ? '#ff4d4f' : '#666',
              }}>卖出</div>
            </div>
          </Form.Item>

          <Form.Item name="date" label="交易日期" rules={[{ required: true }]} initialValue={formatLocalDate(new Date())}>
            <Input type="date" style={{ height: 44 }} onChange={(val) => setDialogDate(val || formatLocalDate(new Date()))} />
          </Form.Item>

          {(selectedDateNav || isPendingNav || isDateNavLoading) && (
            <div style={{
              padding: '12px 16px', borderRadius: '8px', marginBottom: 16,
              background: isPendingNav ? '#f5f5f5' : '#52c41a10',
              border: `1px solid ${isPendingNav ? '#d9d9d9' : '#52c41a'}`,
            }}>
              {isDateNavLoading ? (
                <span style={{ fontSize: 13, color: '#999' }}>正在获取净值...</span>
              ) : isPendingNav ? (
                <span style={{ fontSize: 13, color: '#999' }}>在途交易，净值待定</span>
              ) : selectedDateNav ? (
                <div style={{ fontSize: 14 }}>
                  <span style={{ color: '#666' }}>净值: </span>
                  <span style={{ fontWeight: 600, color: '#333' }}>{selectedDateNav.nav.toFixed(4)}</span>
                  <span style={{ color: '#999', marginLeft: 8 }}>({selectedDateNav.date})</span>
                </div>
              ) : null}
            </div>
          )}

          {currentTradeType === 'buy' ? (
            <>
              <Form.Item
                name="amount" label="交易金额（元）"
                rules={[{ required: true, message: '请输入交易金额' }, { validator: (_, value) => parseFloat(value || '0') > 0 ? Promise.resolve() : Promise.reject(new Error('交易金额必须大于0')) }]}
                help={isPendingNav ? '在途交易，净值待定' : isDateNavLoading ? '正在获取净值...' : selectedDateNav ? `使用净值: ${selectedDateNav.nav.toFixed(4)}` : currentNav ? `使用当前净值: ${currentNav.toFixed(4)}` : ''}
              >
                <Input type="number" placeholder="0.00" style={{ height: 44 }} onChange={(val) => {
                  if (isPendingNav) return;
                  const amount = parseFloat(val || '0');
                  const nav = selectedDateNav?.nav || currentNav;
                  if (amount > 0 && nav) form.setFieldsValue({ shares: (amount / nav).toFixed(2) });
                }} />
              </Form.Item>
              <Form.Item name="shares" label="交易份额" style={{ marginBottom: 0 }}>
                <Input type="number" disabled placeholder="自动计算" style={{ height: 44 }} />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name="shares" label="交易份额"
                rules={[{ required: true, message: '请输入交易份额' }, { validator: (_, value) => parseFloat(value || '0') > 0 ? Promise.resolve() : Promise.reject(new Error('交易份额必须大于0')) }]}
                help={isPendingNav ? '在途交易，净值待定' : isDateNavLoading ? '正在获取净值...' : selectedDateNav ? `使用净值: ${selectedDateNav.nav.toFixed(4)}` : currentNav ? `使用当前净值: ${currentNav.toFixed(4)}` : ''}
              >
                <Input type="number" placeholder="0.00" style={{ height: 44 }} onChange={(val) => {
                  if (isPendingNav) return;
                  const shares = parseFloat(val || '0');
                  const nav = selectedDateNav?.nav || currentNav;
                  if (shares > 0 && nav) form.setFieldsValue({ amount: (shares * nav).toFixed(2) });
                }} />
              </Form.Item>
              <Form.Item name="amount" label="交易金额（元）" style={{ marginBottom: 0 }}>
                <Input type="number" disabled placeholder="自动计算" style={{ height: 44 }} />
              </Form.Item>
            </>
          )}

          <Form.Item name="remark" label="备注">
            <Input placeholder="可选" style={{ height: 44 }} />
          </Form.Item>
        </Form>
      }
      actions={[
        [{
          key: 'cancel',
          text: '取消',
          onClick: () => {
            onClose();
            resetSearch();
            form.resetFields();
            setCurrentTradeType('buy');
          },
        }, {
          key: 'confirm',
          text: '确定',
          bold: true,
          onClick: async () => {
            const values = await form.validateFields();
            if (values) await handleAddTransaction(values);
          },
        }],
      ]}
    />
  );
};

export default AddTransactionDialog;
