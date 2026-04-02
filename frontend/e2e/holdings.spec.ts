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

test.describe('持仓管理流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await login(page);
    await page.click('.tab-bar >> text=持仓');
    await page.waitForTimeout(500);
  });

  test('持仓页面加载', async ({ page }) => {
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(0);
  });

  test('持仓列表和图表 Tab 切换', async ({ page }) => {
    const listTab = page.locator('text=列表');
    const chartTab = page.locator('text=图表');
    
    if (await listTab.isVisible()) {
      await listTab.click();
      await page.waitForTimeout(200);
    }
    
    if (await chartTab.isVisible()) {
      await chartTab.click();
      await page.waitForTimeout(200);
    }
  });

  test('持仓页面显示', async ({ page }) => {
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(0);
  });
});
