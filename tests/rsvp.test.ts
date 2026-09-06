import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@aws-sdk/lib-dynamodb', async () => {
  const original = await vi.importActual<typeof import('@aws-sdk/lib-dynamodb')>('@aws-sdk/lib-dynamodb');
  return { ...original, DynamoDBDocumentClient: { from: () => ({ send }) } };
});
import { handler } from '../infra/functions/rsvp';
import { responseSchema } from '../shared/validation';

const valid = { token: 'a'.repeat(43), attendance: 'attending', name: '山田 花子', kana: 'やまだ はなこ', email: '', allergies: '卵', message: 'おめでとうございます', consent: true, website: '' };
function invoke(body: unknown, options: Partial<APIGatewayProxyEventV2> = {}) {
  const event = { requestContext: { http: { method: 'POST' } }, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), ...options } as APIGatewayProxyEventV2;
  return handler(event, {} as Context, () => {}) as Promise<{ statusCode: number; body: string; headers: Record<string, string> }>;
}

beforeEach(() => {
  send.mockReset();
  process.env.TABLE_NAME = 'test-table';
  process.env.RSVP_DEADLINE = '2099-11-13T23:59:59+09:00';
});

describe('出欠受付', () => {
  it('成功・入力エラー・内部エラーでもCORSヘッダーを返す', async () => {
    send.mockResolvedValue({});
    const success = await invoke(valid);
    const invalid = await invoke(null, { body: '{' });
    send.mockRejectedValue(new Error('unavailable'));
    const failure = await invoke(valid);
    expect([success.statusCode, invalid.statusCode, failure.statusCode]).toEqual([201, 400, 503]);
    for (const response of [success, invalid, failure]) {
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    }
  });
  it('OPTIONSは本文なしでCORSを返し、DBへアクセスしない', async () => {
    const response = await invoke(null, { requestContext: { http: { method: 'OPTIONS' } } as APIGatewayProxyEventV2['requestContext'] });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(response.headers).toMatchObject({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    expect(send).not.toHaveBeenCalled();
  });
  it('メールなしで登録し、生の招待トークンを保存しない', async () => {
    send.mockResolvedValue({});
    expect((await invoke(valid)).statusCode).toBe(201);
    const transaction = send.mock.calls[1][0].input.TransactItems;
    expect(transaction[0].ConditionCheck.ConditionExpression).toContain('expiresAt > :now');
    expect(transaction[1].Put.Item.email).toBe('');
    expect(transaction[1].Put.Item.token).toBeUndefined();
    expect(transaction[1].Put.Item.pk).not.toContain(valid.token);
  });
  it('欠席の場合はアレルギー情報を保存しない', async () => {
    send.mockResolvedValue({});
    expect((await invoke({ ...valid, attendance: 'declining' })).statusCode).toBe(201);
    expect(send.mock.calls[1][0].input.TransactItems[1].Put.Item.allergies).toBe('');
  });
  it('同意なし・不正なメール・未知の項目を拒否する', async () => {
    for (const body of [{ ...valid, consent: false }, { ...valid, email: 'invalid' }, { ...valid, admin: true }]) expect((await invoke(body)).statusCode).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
  it('メールアドレスは省略可能、入力時は正規化する', () => {
    const { email: _, ...withoutEmail } = valid;
    expect(responseSchema.parse(withoutEmail).email).toBe('');
    expect(responseSchema.parse({ ...valid, email: ' Guest@Example.com ' }).email).toBe('guest@example.com');
  });
  it('期限後の新規回答を拒否する', async () => {
    send.mockResolvedValue({});
    process.env.RSVP_DEADLINE = '2020-11-13T23:59:59+09:00';
    expect((await invoke(valid)).statusCode).toBe(410);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('同じ回答の再送は書き込みもメールイベントも増やさない', async () => {
    send.mockResolvedValue({});
    await invoke(valid);
    const item = send.mock.calls[1][0].input.TransactItems[1].Put.Item;
    send.mockReset().mockResolvedValue({ Item: item });
    expect((await invoke(valid)).statusCode).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('別の内容の二重回答は上書きしない', async () => {
    send.mockResolvedValue({ Item: { payloadHash: 'other' } });
    expect((await invoke(valid)).statusCode).toBe(409);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('未発行・失効した招待リンクを拒否する', async () => {
    send.mockResolvedValueOnce({}).mockRejectedValueOnce(Object.assign(new Error('cancelled'), { name: 'TransactionCanceledException' })).mockResolvedValueOnce({});
    expect((await invoke(valid)).statusCode).toBe(403);
  });
  it('不正JSONと大きすぎるリクエストを拒否する', async () => {
    expect((await invoke(null, { body: '{' })).statusCode).toBe(400);
    expect((await invoke(null, { body: 'a'.repeat(12001) })).statusCode).toBe(413);
    expect(send).not.toHaveBeenCalled();
  });
  it('ストレージ障害を登録成功として扱わない', async () => {
    send.mockRejectedValue(new Error('unavailable'));
    expect((await invoke(valid)).statusCode).toBe(503);
  });
});
