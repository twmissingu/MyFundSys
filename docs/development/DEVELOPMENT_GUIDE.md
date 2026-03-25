# MyFundSys 开发指南

## 📚 目录

1. [项目结构](#项目结构)
2. [开发规范](#开发规范)
3. [代码注释规范](#代码注释规范)
4. [测试指南](#测试指南)
5. [调试技巧](#调试技巧)
6. [常见问题](#常见问题)

## 项目结构

```
frontend/src/
├── pages/           # 页面组件
│   ├── Dashboard.tsx       # 仪表盘
│   ├── FundList.tsx        # 基金列表
│   ├── Holdings.tsx        # 持仓管理
│   ├── Transactions.tsx    # 交易记录
│   └── Settings.tsx        # 设置
├── components/      # 可复用组件
├── services/        # API 服务
│   ├── fundApi.ts          # 基金 API
│   ├── syncService.ts      # 同步服务
│   └── articleService.ts   # 文章服务
├── hooks/           # 自定义 Hooks
│   ├── useDB.ts            # 数据库 Hook
│   ├── useSync.ts          # 同步 Hook
│   └── useSupabase.ts      # Supabase Hook
├── db/              # 数据库配置
│   └── index.ts            # IndexedDB 配置
├── types/           # TypeScript 类型
│   └── index.ts            # 全局类型定义
└── utils/           # 工具函数
    ├── index.ts            # 通用工具
    ├── csv.ts              # CSV 处理
    └── technicalIndicators.ts  # 技术指标
```

## 开发规范

### 命名规范

- **组件**: PascalCase (如 `FundList.tsx`)
- **函数**: camelCase (如 `fetchFundNav`)
- **常量**: UPPER_SNAKE_CASE (如 `CACHE_DURATION`)
- **类型**: PascalCase (如 `FundApiData`)
- **接口**: PascalCase + I 前缀 (如 `IFundData`)

### 文件组织

每个文件应包含：
1. 文件头注释（JSDoc）
2. import 语句
3. 类型定义
4. 常量定义
5. 函数/组件定义
6. export 导出

### 代码风格

- 使用 2 空格缩进
- 使用单引号
- 使用分号
- 最大行长度 100 字符
- 使用 TypeScript 严格模式

## 代码注释规范

### 文件头注释

```typescript
/**
 * @fileoverview 文件简短描述
 * @description 详细描述文件功能
 * @module 模块路径
 * @author 作者
 * @version 版本号
 */
```

### 函数注释

```typescript
/**
 * 函数简短描述
 * @description 详细描述
 * @param {类型} 参数名 - 参数描述
 * @returns {类型} 返回值描述
 * @throws {错误类型} 错误描述
 * @example
 * // 使用示例
 */
```

### 组件注释

```typescript
/**
 * 组件名称
 * @description 组件功能描述
 * @param {Props} props - 组件属性
 * @returns {JSX.Element} 渲染结果
 * @example
 * <Component prop1="value" />
 */
```

## 测试指南

### 测试文件位置

- 单元测试: `src/**/__tests__/*.test.ts`
- 组件测试: `src/pages/__tests__/*.test.tsx`
- 集成测试: `tests/integration/*.test.ts`

### 测试命名规范

```typescript
// 描述性命名
describe('功能模块', () => {
  it('应该在特定条件下执行特定操作', () => {
    // 测试代码
  });
  
  it('应该处理错误情况', () => {
    // 测试代码
  });
});
```

### 测试最佳实践

1. **独立性**: 每个测试应该独立运行
2. **可重复性**: 测试结果应该一致
3. **快速性**: 测试应该快速执行
4. **可读性**: 测试代码应该易于理解

### Mock 指南

```typescript
// Mock 模块
vi.mock('../hooks/useDB', () => ({
  useDB: () => ({
    holdings: [],
    loading: false,
  }),
}));

// Mock 函数
const mockFn = vi.fn();
mockFn.mockReturnValue('mocked value');

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ data: 'test' }),
  })
);
```

## 调试技巧

### 浏览器调试

1. **React DevTools**: 检查组件树和状态
2. **Redux DevTools**: 查看状态变化（如使用）
3. **Network Panel**: 检查 API 请求
4. **Console**: 查看日志输出

### 日志记录

```typescript
// 开发环境日志
if (import.meta.env.DEV) {
  console.log('[Debug]', data);
}

// 分级日志
console.log('[Info]', '普通信息');
console.warn('[Warn]', '警告信息');
console.error('[Error]', '错误信息');
```

### 性能调试

```typescript
// 性能计时
console.time('操作名称');
// ... 执行操作
console.timeEnd('操作名称');

// React Profiler
import { Profiler } from 'react';

<Profiler id="组件名" onRender={callback}>
  <Component />
</Profiler>
```

## 常见问题

### Q: 如何添加新页面？

A:
1. 在 `src/pages/` 创建组件文件
2. 在 `src/main.tsx` 添加路由
3. 在 `src/pages/Layout.tsx` 添加导航链接
4. 创建对应的测试文件

### Q: 如何添加新的 API 服务？

A:
1. 在 `src/services/` 创建服务文件
2. 定义类型接口
3. 实现 API 函数
4. 添加错误处理
5. 创建测试文件

### Q: 如何处理数据库迁移？

A:
1. 修改 `src/db/index.ts` 中的 schema
2. 增加数据库版本号
3. 在 upgrade 函数中处理迁移逻辑
4. 测试数据迁移

### Q: 如何添加新的环境变量？

A:
1. 在 `.env.example` 添加变量名
2. 在 `.env` 添加实际值
3. 在代码中使用 `import.meta.env.VITE_XXX`
4. 更新文档

## 提交规范

### Commit Message 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

- **feat**: 新功能
- **fix**: 修复
- **docs**: 文档
- **style**: 格式
- **refactor**: 重构
- **test**: 测试
- **chore**: 构建/工具

### 示例

```
feat(fund): 添加基金搜索功能

- 实现基金代码和名称搜索
- 添加搜索结果缓存
- 添加加载状态

Closes #123
```

## 性能优化

### 代码分割

```typescript
// 懒加载组件
const FundDetail = lazy(() => import('./pages/FundDetail'));

// 路由懒加载
<Route path="/fund/:code" element={<FundDetail />} />
```

### 缓存策略

```typescript
// 数据缓存
const cache = new Map();

function getCachedData(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}
```

### 虚拟列表

对于长列表使用虚拟滚动：

```typescript
import { List } from 'antd-mobile';

// 使用分页或虚拟滚动
<List>
  {data.slice(0, 100).map(item => (
    <List.Item key={item.id}>{item.name}</List.Item>
  ))}
</List>
```

## 安全注意事项

1. **不要在代码中硬编码密码**
2. **敏感数据使用环境变量**
3. **API 请求添加错误处理**
4. **用户输入需要验证**
5. **定期更新依赖包**

## 相关文档

- [项目文档](./PROJECT_DOCUMENTATION.md)
- [API 文档](./API_DOCUMENTATION.md)
- [部署指南](./DEPLOYMENT.md)
- [测试报告](./TEST_REPORT.md)
