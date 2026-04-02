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

test.describe('页面导航流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await login(page);
  });

  test('底部 Tab 导航切换', async ({ page }) => {
    const tabs = ['首页', '基金', '持仓', '交易'];

    for (const tabName of tabs) {
      await page.click(`.tab-bar >> text=${tabName}`);
      await page.waitForTimeout(300);
    }
  });

  test('Hash 路由导航到基金详情', async ({ page }) => {
    await page.goto('/#fund/000001');
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/#fund\/000001/);
  });

  test('Hash 路由导航到持仓页', async ({ page }) => {
    await page.goto('/#holdings');
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/#holdings/);
  });
});
