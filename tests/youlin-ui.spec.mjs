// @ts-check
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:8787';

test.describe('Youlin Desktop UI - 页面渲染', () => {

  test('01-桌面主页加载成功', async ({ page }) => {
    await page.goto(`${BASE}/desktop`, { waitUntil: 'networkidle' });
    await expect(page.locator('.sidebar-title')).toBeVisible();
    await expect(page.locator('.sidebar-title')).toContainText('Youlin');
  });

  test('02-设置页加载成功', async ({ page }) => {
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('03-迁移页加载成功', async ({ page }) => {
    await page.goto(`${BASE}/migrate`, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('04-主页加载成功', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Youlin Desktop UI - 交互', () => {

  test('05-侧边栏快捷切换按钮可见', async ({ page }) => {
    await page.goto(`${BASE}/desktop`, { waitUntil: 'networkidle' });
    const btns = page.locator('.quick-switch-btn');
    await expect(btns.first()).toBeVisible({ timeout: 5000 });
    const count = await btns.count();
    expect(count).toBeGreaterThan(0);
  });

  test('06-Tab 切换正常', async ({ page }) => {
    await page.goto(`${BASE}/desktop`, { waitUntil: 'networkidle' });
    // 切到迁移 Tab
    const migrationTab = page.locator('.tab-btn').filter({ hasText: /迁移|Migration/ });
    await expect(migrationTab).toBeVisible();
    await migrationTab.click();
    await page.waitForTimeout(500);
    await expect(page.locator('#tabContentMigration')).toBeVisible();

    // 切回 Provider Tab
    const providerTab = page.locator('.tab-btn').filter({ hasText: /供应商|Provider/ });
    await providerTab.click();
    await page.waitForTimeout(500);
    await expect(page.locator('#tabContentProvider')).toBeVisible();
  });

  test('07-预设芯片渲染', async ({ page }) => {
    await page.goto(`${BASE}/desktop`, { waitUntil: 'networkidle' });
    // 预设芯片是静态 HTML 中的，应该立即出现
    const chips = page.locator('.preset-chips .chip');
    await expect(chips.first()).toBeVisible({ timeout: 5000 });
    const count = await chips.count();
    expect(count).toBeGreaterThan(0);
  });

  test('08-供应商表单输入框正确', async ({ page }) => {
    await page.goto(`${BASE}/desktop`, { waitUntil: 'networkidle' });

    // 实际 input id 是 fName / fBaseURL / fModel
    const nameInput = page.locator('#fName');
    const urlInput = page.locator('#fBaseURL');
    const modelInput = page.locator('#fModel');

    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await expect(urlInput).toBeVisible();
    await expect(modelInput).toBeVisible();

    // 填写表单（不提交）
    await nameInput.fill('TestProvider');
    await urlInput.fill('https://api.test.com/v1');
    await modelInput.fill('test-model-v1');

    await expect(nameInput).toHaveValue('TestProvider');
    await expect(urlInput).toHaveValue('https://api.test.com/v1');
    await expect(modelInput).toHaveValue('test-model-v1');
  });
});

test.describe('Youlin API 端点', () => {

  test('09-API 状态端点返回有效数据', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/api/status`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty('mode');
    expect(data).toHaveProperty('models');
  });

  test('10-Codex presets 端点', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/api/codex/status`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.presets).toBeDefined();
    expect(Array.isArray(data.presets)).toBe(true);
  });
});

test.describe('Youlin 截图验证', () => {

  test('11-截图: 桌面主页', async ({ page }) => {
    await page.goto(`${BASE}/desktop`, { waitUntil: 'networkidle' });
    await expect(page.locator('.sidebar-title')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/desktop-full.png', fullPage: false });
  });

  test('12-截图: 迁移页面', async ({ page }) => {
    await page.goto(`${BASE}/migrate`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/migrate.png', fullPage: false });
  });

  test('13-截图: 设置页面', async ({ page }) => {
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/settings.png', fullPage: false });
  });
});
