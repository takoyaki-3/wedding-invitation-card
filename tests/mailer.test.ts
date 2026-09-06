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
  process.env.GROOM_EMAIL = '';
  process.env.BRIDE_EMAIL = '';
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
  expect(mail.Content.Simple.Body.Html.Data).toContain('Thank you for your reply.');
  expect(mail.Content.Simple.Body.Html.Data).toContain('アレルギー・お食事：卵');
  expect(dbSend.mock.calls[1][0].input.ExpressionAttributeNames).toEqual({ '#flag': 'guestMailSent' });
});
it('送信済みなら再送しない', async () => {
  dbSend.mockResolvedValue({ Item: { ...item, email: 'guest@example.com', guestMailSent: true } });
  await run();
  expect(sesSend).not.toHaveBeenCalled();
});
it('HTML内の入力値をエスケープし、改行を保ち、主催者にもHTMLを送る', async () => {
  process.env.HOST_EMAIL = 'host@example.com';
  dbSend.mockResolvedValue({ Item: { ...item, email: 'guest@example.com', name: '<img src=x onerror=alert(1)>', message: 'A & B\n<script>alert(1)</script>' } });
  await run();
  expect(sesSend).toHaveBeenCalledTimes(2);
  for (const [command] of sesSend.mock.calls) {
    const body = command.input.Content.Simple.Body;
    expect(body.Html.Charset).toBe('UTF-8');
    expect(body.Html.Data).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(body.Html.Data).toContain('A &amp; B<br>&lt;script&gt;');
    expect(body.Html.Data).not.toContain('<script>');
    expect(body.Text.Data).toContain('A & B\n<script>');
  }
  expect(sesSend.mock.calls[1][0].input.Content.Simple.Body.Html.Data).toContain('A reply has arrived.');
});
it('欠席のHTMLメールにはアレルギー欄を表示しない', async () => {
  dbSend.mockResolvedValue({ Item: { ...item, email: 'guest@example.com', attendance: 'declining' } });
  await run();
  const html = sesSend.mock.calls[0][0].input.Content.Simple.Body.Html.Data;
  expect(html).toContain('ご出欠：ご欠席');
  expect(html).not.toContain('アレルギー・お食事');
});
it('SES失敗は再試行へ渡し、送信済みにしない', async () => {
  dbSend.mockResolvedValue({ Item: { ...item, email: 'guest@example.com' } });
  sesSend.mockRejectedValue(new Error('SES unavailable'));
  await expect(run()).rejects.toThrow('notification deliveries failed');
  expect(dbSend).toHaveBeenCalledTimes(1);
});
it('回答以外のストリームイベントは無視する', async () => {
  await handler({ Records: [{ eventName: 'INSERT', dynamodb: { Keys: { pk: { S: 'INVITE#test' } } } }] } as DynamoDBStreamEvent, {} as Context, () => {});
  expect(dbSend).not.toHaveBeenCalled();
});

it('回答者のメール未入力でも新郎・新婦へ個別に通知する', async () => {
  process.env.GROOM_EMAIL = 'groom@example.com';
  process.env.BRIDE_EMAIL = 'bride@example.com';
  dbSend.mockResolvedValue({ Item: item });
  await run();
  expect(sesSend.mock.calls.map(([command]) => command.input.Destination.ToAddresses)).toEqual([['groom@example.com'], ['bride@example.com']]);
  for (const [command] of sesSend.mock.calls) {
    expect(command.input.Content.Simple.Body.Text.Data).toContain('新しい出欠回答を受け付けました');
    expect(command.input.Content.Simple.Body.Text.Data).toContain('お名前：山田 花子');
    expect(command.input.Content.Simple.Body.Text.Data).toContain('メールアドレス：未登録');
    expect(command.input.Content.Simple.Body.Html.Data).toContain('A reply has arrived.');
    expect(command.input.Content.Simple.Body.Html.Data).toContain('お名前：山田 花子');
  }
  expect(dbSend.mock.calls.slice(1).map(([command]) => command.input.ExpressionAttributeNames['#flag'])).toEqual(['groomMailSent', 'brideMailSent']);
});

it('回答者へのコピーが失敗しても新郎・新婦に通知する', async () => {
  process.env.GROOM_EMAIL = 'groom@example.com';
  process.env.BRIDE_EMAIL = 'bride@example.com';
  dbSend.mockResolvedValue({ Item: { ...item, email: 'guest@example.com' } });
  sesSend.mockRejectedValueOnce(new Error('Guest mailbox failure'));
  await expect(run()).rejects.toThrow('notification deliveries failed');
  expect(sesSend.mock.calls.map(([command]) => command.input.Destination.ToAddresses)).toEqual([['guest@example.com'], ['groom@example.com'], ['bride@example.com']]);
});

it('片方が失敗した後の再試行では、未送信の宛先だけに通知する', async () => {
  process.env.GROOM_EMAIL = 'groom@example.com';
  process.env.BRIDE_EMAIL = 'bride@example.com';
  const state: Record<string, unknown> = { ...item, attendance: 'declining' };
  dbSend.mockImplementation(async command => {
    if (command.input.UpdateExpression) {
      state[command.input.ExpressionAttributeNames['#flag']] = true;
      return {};
    }
    return { Item: { ...state } };
  });
  sesSend.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Bride mailbox failure'));
  await expect(run()).rejects.toThrow('notification deliveries failed');
  expect(state.groomMailSent).toBe(true);
  expect(state.brideMailSent).toBeUndefined();
  await run();
  expect(sesSend.mock.calls.map(([command]) => command.input.Destination.ToAddresses)).toEqual([['groom@example.com'], ['bride@example.com'], ['bride@example.com']]);
  expect(sesSend.mock.calls[2][0].input.Content.Simple.Body.Text.Data).toContain('ご出欠：ご欠席');
  expect(state.brideMailSent).toBe(true);
});
