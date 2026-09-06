import { test, expect } from '@playwright/test';
import { loadEnvironment } from '../config/environment';
import { existsSync, readdirSync } from 'node:fs';

const { wedding } = loadEnvironment();
const endpoint = 'https://api.example.com/custom-rsvp';
const photoDirectory = new URL('../public/photo/', import.meta.url);
const photoCount = existsSync(photoDirectory) ? readdirSync(photoDirectory).filter(name => /\.(jpe?g|png|webp|avif)$/i.test(name)).length : 0;

test('ツーショットの表示、前後移動と自動再生の停止', async ({ page }, testInfo) => {
  test.skip(photoCount < 2, 'ローカルの写真を2枚以上配置した環境で実行');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const gallery = page.getByRole('region', { name: 'ふたりの写真' });
  await gallery.scrollIntoViewIfNeeded();
  const photo = gallery.locator('img');
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(gallery.getByRole('button', { name: 'スライドショーを再生' })).toBeVisible();
  const first = await photo.getAttribute('src');
  await gallery.getByRole('button', { name: '前の写真', exact: true }).click();
  await expect(photo).toHaveAttribute('alt', `ふたりのツーショット写真 ${photoCount}`);
  await gallery.getByRole('button', { name: '次の写真', exact: true }).click();
  await expect(photo).toHaveAttribute('src', first!);
  await page.clock.install();
  await gallery.getByRole('button', { name: 'スライドショーを再生' }).click();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(5100);
  await expect(photo).toHaveAttribute('alt', 'ふたりのツーショット写真 2');
  await gallery.getByRole('button', { name: 'スライドショーを一時停止' }).evaluate(button => button.blur());
  await gallery.getByRole('button', { name: 'スライドショーを一時停止' }).click();
  await page.clock.fastForward(10000);
  await expect(photo).toHaveAttribute('alt', 'ふたりのツーショット写真 2');
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await gallery.screenshot({ path: `test-results/${testInfo.project.name}-couple-gallery.png` });
});

test('招待状の表示、任意メールなしの出席、欠席フォーム', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/');
  const github = page.getByRole('link', { name: 'GitHubでソースコードを見る（新しいタブ）' });
  await expect(github).toBeVisible();
  await expect(github).toHaveAttribute('href', 'https://github.com/takoyaki-3/wedding-invitation-card');
  await expect(page.getByRole('heading', { name: `${wedding.groom} & ${wedding.bride}`, exact: true })).toBeVisible();
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
  await page.route('**/config.json', route => route.fulfill({ json: { demo: false, rsvpEndpoint: endpoint } }));
  let payload: Record<string, unknown> | undefined;
  await page.route(endpoint, async route => {
    payload = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { message: '回答を受け付けました。' } });
  });
  await page.goto(`/?group=family#invite=${token}`);
  await expect(page).toHaveURL('http://127.0.0.1:5173/?group=family');
  await expect(page.locator('.schedule-card').first()).toContainText('11:25');
  await expect(page.locator('.schedule-card').first()).toContainText('4階親族控室');
  await page.getByLabel('お名前', { exact: false }).fill('山田 花子');
  await page.getByLabel('ふりがな', { exact: false }).fill('やまだ はなこ');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'この内容で回答する' }).click();
  await expect(page.getByRole('heading', { name: 'ご回答ありがとうございます' })).toBeVisible();
  expect(payload?.token).toBe(token);
  expect(payload?.email).toBe('');
  expect(payload).not.toHaveProperty('group');
});

test('クエリの区分に応じて集合案内を表示する', async ({ page }) => {
  for (const query of ['', '?group=friend', '?group=unknown', '?group=family']) {
    await page.goto(`/${query}`);
    const gathering = page.locator('.schedule-card').first();
    await expect(gathering).toContainText(query === '?group=family' ? '11:25' : '12:00');
    await expect(gathering).toContainText(query === '?group=family' ? '4階親族控室' : '4階ロビー');
    await expect(page.locator('.schedule-card').nth(1)).toContainText(wedding.ceremonyTime);
    await expect(page.locator('.schedule-card').nth(2)).toContainText(wedding.partyTime);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('招待リンクなしの本番フォームは送信不可', async ({ page }) => {
  await page.route('**/config.json', route => route.fulfill({ json: { demo: false, rsvpEndpoint: endpoint } }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'この内容で回答する' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('専用の招待リンク');
});

test('本番設定にAPI URLがない場合は送信を無効にする', async ({ page }) => {
  await page.route('**/config.json', route => route.fulfill({ json: { demo: false, rsvpEndpoint: '' } }));
  await page.goto(`/#invite=${'b'.repeat(43)}`);
  await expect(page.getByRole('alert')).toContainText('設定を読み込めませんでした');
  await expect(page.getByRole('button', { name: 'この内容で回答する' })).toBeDisabled();
});
