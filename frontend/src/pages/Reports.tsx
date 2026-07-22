import React from 'react';
import { SpinLoading, Empty, Button, Toast } from 'antd-mobile';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useHoldings } from '../hooks/useSync';
import { exportDatabase, importDatabase } from '../db';
import { dispatchDataChanged } from '../utils/dataChangeEvent';
import { UploadOutline, DownlandOutline } from 'antd-mobile-icons';
import './Layout.css';

const COLORS = ['#1677ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fadb14'];

const Reports: React.FC = () => {
  const { holdings, loading, error } = useHoldings();

  // 按分类统计
  const categoryData = React.useMemo(() => {
    const getCategory = (name: string) => {
      const match = name.match(/^(.+?(?:ETF|LOF|指数|债券|货币|混合|股票))/);
      return match ? match[1] : name;
    };
    const map = new Map<string, number>();
    holdings.forEach(h => {
      const category = getCategory(h.fundName);
      map.set(category, (map.get(category) || 0) + (h.currentValue || 0));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [holdings]);

  const handleExport = async () => {
    try {
      const data = await exportDatabase();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fund-data-${new Date().toLocaleDateString('sv-SE')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      Toast.show({ icon: 'success', content: '导出成功' });
    } catch (error) {
      Toast.show({ icon: 'fail', content: '导出失败' });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await importDatabase(text);
      Toast.show({ icon: 'success', content: '导入成功' });
      dispatchDataChanged();
    } catch (error) {
      Toast.show({ icon: 'fail', content: '导入失败，请检查文件格式' });
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <SpinLoading style={{ '--size': '48px' }} />
      </div>
    );
  }

  return (
    <div className="reports">
      {/* 数据导入导出 */}
      <div className="card">
        <div className="card-title">数据管理</div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button color="primary" fill="solid" onClick={handleExport}>
            <DownlandOutline /> 导出数据
          </Button>
          <label style={{ flex: 1 }}>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
            <Button color="primary" fill="outline" block>
              <UploadOutline /> 导入数据
            </Button>
          </label>
        </div>
      </div>

      {holdings.length === 0 ? (
        <Empty description={error || '暂无持仓数据，无法生成报告'} />
      ) : (
        <>
          {/* 资产配置饼图 */}
          <div className="card">
            <div className="card-title">资产配置</div>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `¥${value.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 持仓分布柱状图 */}
          <div className="card">
            <div className="card-title">持仓分布</div>
            <div style={{ height: '250px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData.slice(0, 6)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(value: number) => `¥${value.toFixed(2)}`} />
                  <Bar dataKey="value" fill="#1677ff" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
