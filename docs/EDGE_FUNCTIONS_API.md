# Supabase Edge Functions API 文档

> 本文档描述项目中的 Edge Functions 接口

---

## 通用规则

- 所有请求使用 **POST** 方法
- 请求体格式: `{ body: { ... } }`
- 响应格式: JSON

---

## fund-nav

获取基金净值数据

### 请求

```typescript
{
  code: string;  // 基金代码，如 "000001"
}
```

### 响应

```typescript
{
  code: string;           // 基金代码
  name: string;          // 基金名称
  nav: number;           // 最新净值
  navDate: string;       // 净值日期 (YYYY-MM-DD)
  estimateNav?: number;  // 估算净值（当日）
  estimateRate?: number; // 估算涨跌幅 (%)
}
```

### 示例

```typescript
const { data } = await supabase.functions.invoke('fund-nav', {
  body: { code: '000001' }
});
```

---

## fund-search

基金搜索

### 请求

```typescript
{
  keyword: string;  // 搜索关键词（代码或名称）
}
```

### 响应

```typescript
{
  code: string;   // 基金代码
  name: string;  // 基金名称
  type?: string;  // 基金类型
}[]
```

### 示例

```typescript
const { data } = await supabase.functions.invoke('fund-search', {
  body: { keyword: '华夏成长' }
});
```

---

## fund-history

获取基金历史净值

### 请求

```typescript
{
  code: string;       // 基金代码
  pageSize?: number;  // 每页数量 (默认 20)
  pageIndex?: number; // 页码 (默认 1)
  startDate?: string; // 开始日期 (YYYY-MM-DD)
  endDate?: string;   // 结束日期 (YYYY-MM-DD)
}
```

### 响应

```typescript
{
  date: string;           // 日期 (YYYY-MM-DD)
  nav: number;           // 单位净值
  accNav: number;        // 累计净值
  dailyChangeRate: number; // 日涨跌幅 (%)
  buyStatus: string;     // 申购状态
  sellStatus: string;    // 赎回状态
}[]
```

### 示例

```typescript
const { data } = await supabase.functions.invoke('fund-history', {
  body: { 
    code: '000001',
    pageSize: 20,
    pageIndex: 1,
    startDate: '2024-01-01',
    endDate: '2024-12-31'
  }
});
```

---

## 错误处理

所有函数可能返回以下错误:

| 状态码 | 描述 |
|--------|------|
| 400 | 请求参数错误 |
| 500 | 服务器内部错误 |
| 429 | 请求过于频繁（限流） |

错误响应格式:

```typescript
{
  error: string;  // 错误信息
}
```

---

## 请求频率限制

- 单个请求: 无限制
- 批量请求: 建议间隔 500ms
- 东方财富 API 可能有自身的限流策略

---

## 相关文件

- `supabase/functions/fund-nav/index.ts`
- `supabase/functions/fund-search/index.ts`
- `supabase/functions/fund-history/index.ts`