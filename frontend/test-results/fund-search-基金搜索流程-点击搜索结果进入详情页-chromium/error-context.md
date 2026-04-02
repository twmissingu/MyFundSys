# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fund-search.spec.ts >> 基金搜索流程 >> 点击搜索结果进入详情页
- Location: e2e/fund-search.spec.ts:46:3

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const TEST_PASSWORD = process.env.TEST_PASSWORD || '';
  4  | 
  5  | // 登录辅助函数
  6  | async function login(page: any) {
  7  |   const passwordInput = page.locator('input[type="password"]');
  8  |   if (await passwordInput.isVisible({ timeout: 3000 }).catch(() => false)) {
  9  |     await passwordInput.fill(TEST_PASSWORD);
  10 |     await page.click('button:has-text("进入系统")');
  11 |     await page.waitForTimeout(500);
  12 |   }
  13 | }
  14 | 
  15 | test.describe('基金搜索流程', () => {
> 16 |   test.beforeEach(async ({ page }) => {
     |        ^ Test timeout of 30000ms exceeded while running "beforeEach" hook.
  17 |     await page.goto('/');
  18 |     await page.waitForLoadState('networkidle');
  19 |     await login(page);
  20 |   });
  21 | 
  22 |   test('搜索基金代码', async ({ page }) => {
  23 |     await page.click('text=基金');
  24 |     await page.waitForTimeout(300);
  25 |     
  26 |     const codeSearch = page.getByPlaceholder('输入基金代码');
  27 |     await codeSearch.fill('000001');
  28 |     await page.waitForTimeout(500);
  29 |     
  30 |     const results = page.locator('text=搜索结果');
  31 |     await expect(results).toBeVisible({ timeout: 5000 });
  32 |   });
  33 | 
  34 |   test('搜索基金名称', async ({ page }) => {
  35 |     await page.click('text=基金');
  36 |     await page.waitForTimeout(300);
  37 |     
  38 |     const nameSearch = page.getByPlaceholder('输入基金名称');
  39 |     await nameSearch.fill('沪深');
  40 |     await page.waitForTimeout(500);
  41 |     
  42 |     const results = page.locator('text=搜索结果');
  43 |     await expect(results).toBeVisible({ timeout: 5000 });
  44 |   });
  45 | 
  46 |   test('点击搜索结果进入详情页', async ({ page }) => {
  47 |     await page.click('text=基金');
  48 |     await page.waitForTimeout(300);
  49 |     
  50 |     const codeSearch = page.getByPlaceholder('输入基金代码');
  51 |     await codeSearch.fill('000001');
  52 |     await page.waitForTimeout(500);
  53 |     
  54 |     const firstResult = page.locator('[style*="cursor: pointer"]').first();
  55 |     await firstResult.click();
  56 |     
  57 |     await expect(page).toHaveURL(/#fund\/\d+/);
  58 |   });
  59 | });
  60 | 
```