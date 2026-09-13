import { test, expect } from '@playwright/test';

test('同伴者を追加・削除し、個別の出欠をまとめて送信する', async ({ page }) => {
  const endpoint = 'https://api.example.com/rsvp';
  await page.route('**/config.json', route => route.fulfill({ json: { demo: false, rsvpEndpoint: endpoint } }));
  let payload: any;
  await page.route(endpoint, async route => {
    payload = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: {} });
  });
  await page.goto(`/#invite=${'b'.repeat(43)}`);
  await page.getByLabel('姓', { exact: true }).fill('山田');
  await page.getByLabel('名', { exact: true }).fill('花子');
  await page.getByLabel('せい', { exact: true }).fill('やまだ');
  await page.getByLabel('めい', { exact: true }).fill('はなこ');
  const add = page.getByRole('button', { name: '同伴者を追加' });
  await add.click();
  await add.click();
  await add.click();
  await page.getByRole('button', { name: '同伴者 2 を削除' }).click();
  const first = page.getByRole('group', { name: '同伴者 1', exact: true });
  const second = page.getByRole('group', { name: '同伴者 2', exact: true });
  await first.getByLabel('お名前').fill('山田 太郎');
  await first.getByLabel('ふりがな').fill('やまだ たろう');
  await first.getByLabel('アレルギー').fill('小麦');
  await second.getByLabel('お名前').fill('山田 次郎');
  await second.getByLabel('ふりがな').fill('やまだ じろう');
  await second.getByLabel('アレルギー').fill('卵');
  await second.getByRole('radio', { name: 'ご欠席' }).check();
  await expect(second.getByLabel('アレルギー')).toHaveCount(0);
  await expect(page.getByText('回答人数：3名')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'この内容で回答する' }).click();
  await expect(page.getByRole('heading', { name: 'ご回答ありがとうございます' })).toBeVisible();
  expect(payload.companions).toEqual([
    { name: '山田 太郎', kana: 'やまだ たろう', attendance: 'attending', allergies: '小麦' },
    { name: '山田 次郎', kana: 'やまだ じろう', attendance: 'declining', allergies: '' }
  ]);
});
