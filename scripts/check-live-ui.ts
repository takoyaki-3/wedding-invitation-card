import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const outputs = JSON.parse(await readFile('cdk-outputs.json', 'utf8')).WeddingInvitation;
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const [name, width] of [['desktop', 1440], ['mobile', 390]] as const) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    const response = await page.goto(outputs.WebsiteUrl, { waitUntil: 'networkidle' });
    assert.equal(response?.status(), 200);
    assert.ok(response?.headers()['content-security-policy']);
    await page.getByRole('heading', { name: 'Together, a beautiful beginning.' }).waitFor();
    await page.getByText('ご回答には、お送りした専用の招待リンクからアクセスしてください。').waitFor();
    assert.equal(await page.getByRole('button', { name: 'この内容で回答する' }).isDisabled(), true);
    await page.locator('.venue-photo').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => Array.from(document.images).every(img => img.complete && img.naturalWidth > 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: `test-results/live-${name}.png`, fullPage: true });
    await page.close();
    console.log(`PASS: live ${name} UI, images, security headers, and invitation protection`);
  }
} finally { await browser.close(); }
