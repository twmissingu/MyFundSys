import { test, expect } from '@playwright/test';

const TEST_PASSWORD = process.env.TEST_PASSWORD || '';

// 登录辅助函数
async function login(page: any) {
  const passwordInput = page.locator('input[type="password"]');
  if (await passwordInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await passwordInput.fill(TEST_PASSWORD);
    await page.click('button:has-text("进入系统")');
    await page.waitForTimeout(500);
  }
}

test.describe('基金搜索流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await login(page);
  });

  test('搜索基金代码', async ({ page }) => {
    await page.click('text=基金');
    await page.waitForTimeout(300);
    
    const codeSearch = page.getByPlaceholder('输入基金代码');
    await codeSearch.fill('000001');
    await page.waitForTimeout(500);
    
    const results = page.locator('text=搜索结果');
    await expect(results).toBeVisible({ timeout: 5000 });
  });

  test('搜索基金名称', async ({ page }) => {
    await page.click('text=基金');
    await page.waitForTimeout(300);
    
    const nameSearch = page.getByPlaceholder('输入基金名称');
    await nameSearch.fill('沪深');
    await page.waitForTimeout(500);
    
    const results = page.locator('text=搜索结果');
    await expect(results).toBeVisible({ timeout: 5000 });
  });

  test('点击搜索结果进入详情页', async ({ page }) => {
    await page.click('text=基金');
    await page.waitForTimeout(300);
    
    const codeSearch = page.getByPlaceholder('输入基金代码');
    await codeSearch.fill('000001');
    await page.waitForTimeout(500);
    
    const firstResult = page.locator('[style*="cursor: pointer"]').first();
    await firstResult.click();
    
    await expect(page).toHaveURL(/#fund\/\d+/);
  });
});
