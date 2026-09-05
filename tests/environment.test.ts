import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnvironment } from '../config/environment';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true });
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'wedding-env-test-'));
  roots.push(root);
  writeFileSync(join(root, '.env'), readFileSync('.env.example'));
  return root;
}

it('.env.localの日本語・空欄・引用符付き住所を読み込み、シェル設定を優先する', () => {
  const root = fixture();
  writeFileSync(join(root, '.env.local'), 'WEDDING_GROOM="LocalName"\nWEDDING_GROOM_JAPANESE="テスト 太郎"\nWEDDING_ADDRESS="東京都 サンプル1-2-3 # 本館"\nWEDDING_DATE=""\n');
  const local = loadEnvironment(root, {});
  expect(local.wedding.groom).toBe('LocalName');
  expect(local.wedding.groomJapanese).toBe('テスト 太郎');
  expect(local.wedding.address).toBe('東京都 サンプル1-2-3 # 本館');
  expect(local.wedding.date).toBe('');
  expect(loadEnvironment(root, { WEDDING_GROOM: 'FromShell' }).wedding.groom).toBe('FromShell');
});

it('SES設定や認証情報を公開用の設定に混ぜない', () => {
  const settings = loadEnvironment(fixture(), { SES_SENDER_EMAIL: 'sender@example.com', RSVP_HOST_EMAIL: 'host@example.com', AWS_SECRET_ACCESS_KEY: 'private-test-value', WEDDING_UNUSED_SECRET: 'another-private-value' });
  expect(settings.ses.hostEmail).toBe('host@example.com');
  expect(settings.ses.senderEmail).toBe('sender@example.com');
  const publicJson = JSON.stringify(settings.wedding);
  expect(publicJson).not.toMatch(/host@example|sender@example|private-test-value|another-private-value/);
});

it('必要な環境設定がない場合はサンプル値で起動せずエラーにする', () => {
  const root = mkdtempSync(join(tmpdir(), 'wedding-env-test-'));
  roots.push(root);
  expect(() => loadEnvironment(root, {})).toThrow('.env.example');
});

it('タイムゾーンがない日時や不正な締切を拒否する', () => {
  const root = fixture();
  expect(() => loadEnvironment(root, { WEDDING_DATE: '2099-10-22T11:00:00' })).toThrow();
  expect(() => loadEnvironment(root, { WEDDING_DEADLINE: 'not-a-date' })).toThrow();
});

it('新郎新婦の通知先は検証してサーバー専用設定に保持する', () => {
  const root = fixture();
  const settings = loadEnvironment(root, { RSVP_GROOM_EMAIL: 'groom@example.com', RSVP_BRIDE_EMAIL: 'bride@example.com' });
  expect(settings.ses.groomEmail).toBe('groom@example.com');
  expect(settings.ses.brideEmail).toBe('bride@example.com');
  expect(JSON.stringify(settings.wedding)).not.toMatch(/groom@example|bride@example/);
  expect(() => loadEnvironment(root, { RSVP_GROOM_EMAIL: 'invalid' })).toThrow();
});
