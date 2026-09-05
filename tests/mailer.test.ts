import { beforeEach, expect, it, vi } from 'vitest';
import type { Context, DynamoDBStreamEvent } from 'aws-lambda';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { weddingFromEnv } from '../shared/wedding';
const { dbSend, sesSend } = vi.hoisted(() => ({ dbSend: vi.fn(), sesSend: vi.fn() }));
vi.mock('@aws-sdk/lib-dynamodb', async () => ({ ...(await vi.importActual<typeof import('@aws-sdk/lib-dynamodb')>('@aws-sdk/lib-dynamodb')), DynamoDBDocumentClient: { from: () => ({ send: dbSend }) } }));
vi.mock('@aws-sdk/client-sesv2', async () => ({ ...(await vi.importActual<typeof import('@aws-sdk/client-sesv2')>('@aws-sdk/client-sesv2')), SESv2Client: class { send = sesSend; } }));
import { handler } from '../infra/functions/mailer';
const event = { Records: [{ eventName: 'INSERT', dynamodb: { Keys: { pk: { S: 'RSVP#test' } } } }] } as DynamoDBStreamEvent;
const item = { name: '山田 花子', kana: 'やまだ はなこ', attendance: 'attending', email: '', allergies: '卵', message: 'おめでとう！', guestMailSent: false };
const run = () => handler(event, {} as Context, () => {});
beforeEach(() => {
  dbSend.mockReset(); sesSend.mockReset().mockResolvedValue({});
  process.env.WEDDING_CONFIG = JSON.stringify(weddingFromEnv(parseEnv(readFileSync('.env.example', 'utf8'))));
  process.env.SENDER_EMAIL = 'wedding@example.com';
  process.env.HOST_EMAIL = '';
  process.env.SES_CONFIGURATION_SET = 'test-configuration-set';
});
it('任意メールが未入力ならSESを呼ばない', async () => {
  dbSend.mockResolvedValue({ Item: item });
  await run();
  expect(sesSend).not.toHaveBeenCalled();
});
it('入力者へ指定アドレスから回答内容のコピーを送る', async () => {
  dbSend.mockResolvedValue({ Item: { ...item, email: 'guest@example.com' } });
  await run();
  const mail = sesSend.mock.calls[0][0].input;
  expect(mail.FromEmailAddress).toBe('wedding@example.com');
  expect(mail.ConfigurationSetName).toBe('test-configuration-set');
  expect(mail.Destination.ToAddresses).toEqual(['guest@example.com']);
  expect(mail.Content.Simple.Body.Text.Data).toContain('アレルギー・お食事：卵');
  expect(mail.Content.Simple.Body.Text.Data).toContain('おめでとう！');
  expect(dbSend.mock.calls[1][0].input.ExpressionAttributeNames).toEqual({ '#flag': 'guestMailSent' });
});
it('送信済みなら再送しない', async () => {
  dbSend.mockResolvedValue({ Item: { ...item, email: 'guest@example.com', guestMailSent: true } });
  await run();
  expect(sesSend).not.toHaveBeenCalled();
});
it('SES失敗は再試行へ渡し、送信済みにしない', async () => {
  dbSend.mockResolvedValue({ Item: { ...item, email: 'guest@example.com' } });
  sesSend.mockRejectedValue(new Error('SES unavailable'));
  await expect(run()).rejects.toThrow('SES unavailable');
  expect(dbSend).toHaveBeenCalledTimes(1);
});
it('回答以外のストリームイベントは無視する', async () => {
  await handler({ Records: [{ eventName: 'INSERT', dynamodb: { Keys: { pk: { S: 'INVITE#test' } } } }] } as DynamoDBStreamEvent, {} as Context, () => {});
  expect(dbSend).not.toHaveBeenCalled();
});
