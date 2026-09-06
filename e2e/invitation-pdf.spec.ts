import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

for (const group of ['friend', 'family']) {
  test(`${group}: 招待状のPDFをダウンロードできる`, async ({ page }) => {
    await page.goto(`/?group=${group}`);
    const link = page.getByRole('link', { name: '紙の招待状をダウンロード（PDF）' });
    await expect(link).toHaveAttribute('href', `/invitation/${group}.pdf`);
    const response = await page.request.get(`/invitation/${group}.pdf`);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('application/pdf');
    const downloadEvent = page.waitForEvent('download');
    await link.click();
    const download = await downloadEvent;
    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toBe('結婚式の招待状.pdf');
    const bytes = readFileSync((await download.path())!);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.subarray(-30).toString()).toContain('%%EOF');
  });
}
