// @ts-check
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:8787';

test.describe('Youlin Desktop UI', () => {

  test('01-桌面主页加载成功', async ({ page }) => {
    await page.goto(`${BASE}/desktop`);
    await page.waitForSelector('.sidebar-title');
    await expect(page.locator('.sidebar-title')).toHaveText('Youlin');
  });

  test('02-设置页加载成功', async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    await page.waitForSelector('body');
    await expect(page).not.toHaveTitle(/error/i);
  });

  test('03-迁移页加载成功', async ({ page }) => {
    await page.goto(`${BASE}/migrate`);
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toBeVisible();
  });

  test('04-主页加载成功', async ({ page }) => {
    await page.goto(`${BASE}/`);
    await page.waitForSelector('body');
  });

  test('05-侧边栏快速切换按钮可点击', async ({ page }) => {
    await page.goto(`${BASE}/desktop`);
    await page.waitForSelector('.quick-switch-btn', { timeout: 5000 });
    const count = await page.locator('.quick-switch-btn').count();
    expect(count).toBeGreaterThan(0);
    await page.locator('.quick-switch-btn').first().click();
  });

  test('06-Tab 切换正常', async ({ page }) => {
    await page.goto(`${BASE}/desktop`);
    await page.waitForSelector('.tab-btn');
    await page.locator('.tab-btn').filter({ hasText: /迁移|Migration/ }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('#tabContentMigration')).toBeVisible();
    await page.locator('.tab-btn').filter({ hasText: /供应商|Provider/ }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('#tabContentProvider')).toBeVisible();
  });

  test('07-预设芯片渲染', async ({ page }) => {
    await page.goto(`${BASE}/desktop`);
    await page.waitForSelector('.chip', { timeout: 5000 });
    const count = await page.locator('.preset-chips .chip').count();
    expect(count).toBeGreaterThan(0);
  });

  test('08-添加供应商表单存在', async ({ page }) => {
    await page.goto(`${BASE}/desktop`);
    await page.waitForSelector('#providerName', { timeout: 5000 });
    await expect(page.locator('#providerName')).toBeVisible();
    await expect(page.locator('#baseURL')).toBeVisible();
    await expect(page.locator('#modelName')).toBeVisible();
    await page.fill('#providerName', 'TestProvider');
    await page.fill('#baseURL', 'https://api.test.com/v1');
    await page.fill('#modelName', 'test-model-v1');
    await expect(page.locator('#providerName')).toHaveValue('TestProvider');
  });

  test('09-API 状态端点', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/api/status`);
    expect(resp.ok()).toBeTruthy();
  });

  test('10-Codex presets 端点', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/api/codex/status`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(Array.isArray(data.presets)).toBe(true);
  });
});

test.describe('Youlin 截图验证', () => {
  test('11-截图: 桌面主页', async ({ page }) => {
    await page.goto(`${BASE}/desktop`);
    await page.waitForSelector('.sidebar-title', { timeout: 5000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/desktop-full.png', fullPage: false });
  });

  test('12-截图: 迁移页面', async ({ page }) => {
    await page.goto(`${BASE}/migrate`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/migrate.png', fullPage: false });
  });

  test('13-截图: 设置页面', async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/settings.png', fullPage: false });
  });
});
