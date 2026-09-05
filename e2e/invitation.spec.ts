import { test, expect } from '@playwright/test';
import { loadEnvironment } from '../config/environment';

const { wedding } = loadEnvironment();

test('招待状の表示、任意メールなしの出席、欠席フォーム', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Together, a beautiful beginning.' })).toBeVisible();
  await expect(page.getByText(wedding.groomJapanese, { exact: false }).first()).toBeVisible();
  await expect(page.getByText(wedding.venueJapanese, { exact: true })).toBeVisible();
  await expect(page.getByText('プレビュー版：', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('.venue-photo').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.venue-photo img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: `test-results/${testInfo.project.name}-invitation.png`, fullPage: true });
  await page.getByLabel('お名前', { exact: false }).fill('山田 花子');
  await page.getByLabel('ふりがな', { exact: false }).fill('やまだ はなこ');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '回答をプレビューする' }).click();
  await expect(page.getByRole('heading', { name: 'ご回答のプレビューが完了しました' })).toBeVisible();
  await page.getByRole('button', { name: 'フォームに戻る' }).click();
  await page.getByRole('radio', { name: 'ご欠席', exact: false }).check();
  await expect(page.getByLabel('アレルギー・お食事について', { exact: false })).toHaveCount(0);
  await page.getByLabel('お名前', { exact: false }).fill('山田 花子');
  await page.getByLabel('ふりがな', { exact: false }).fill('やまだ はなこ');
  await page.getByLabel('メールアドレス', { exact: false }).fill('guest@example.com');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '回答をプレビューする' }).click();
  await expect(page.getByText('あたたかなお気持ちをありがとうございます。', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});

test('本番モードの招待リンクと任意メールをAPIへ送信する', async ({ page }) => {
  const token = 'b'.repeat(43);
  await page.route('**/runtime-config.json', route => route.fulfill({ json: { demo: false, apiUrl: '' } }));
  let payload: Record<string, unknown> | undefined;
  await page.route('**/api/rsvp', async route => {
    payload = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { message: '回答を受け付けました。' } });
  });
  await page.goto(`/#invite=${token}`);
  await expect(page).toHaveURL('http://127.0.0.1:5173/');
  await page.getByLabel('お名前', { exact: false }).fill('山田 花子');
  await page.getByLabel('ふりがな', { exact: false }).fill('やまだ はなこ');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'この内容で回答する' }).click();
  await expect(page.getByRole('heading', { name: 'ご回答ありがとうございます' })).toBeVisible();
  expect(payload?.token).toBe(token);
  expect(payload?.email).toBe('');
});

test('招待リンクなしの本番フォームは送信不可', async ({ page }) => {
  await page.route('**/runtime-config.json', route => route.fulfill({ json: { demo: false, apiUrl: '' } }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'この内容で回答する' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('専用の招待リンク');
});
