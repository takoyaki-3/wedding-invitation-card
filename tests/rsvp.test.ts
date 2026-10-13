import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@aws-sdk/lib-dynamodb', async () => {
  const original = await vi.importActual<typeof import('@aws-sdk/lib-dynamodb')>('@aws-sdk/lib-dynamodb');
  return { ...original, DynamoDBDocumentClient: { from: () => ({ send }) } };
});
import { handler } from '../infra/functions/rsvp';
import { responseSchema } from '../shared/validation';

const valid = { token: 'a'.repeat(43), attendance: 'attending', name: '山田 花子', kana: 'やまだ はなこ', email: '', allergies: '卵', message: 'おめでとうございます', website: '' };
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
  it('複数人の回答をまとめて保存し、欠席者のアレルギーを除外する', async () => {
    const companions = [
      { name: '山田 太郎', kana: 'やまだ たろう', attendance: 'attending', allergies: '小麦' },
      { name: '山田 次郎', kana: 'やまだ じろう', attendance: 'declining', allergies: '卵' }
    ];
    send.mockResolvedValue({});
    expect((await invoke({ ...valid, companions })).statusCode).toBe(201);
    const item = send.mock.calls[1][0].input.TransactItems[1].Put.Item;
    expect(item.companions).toEqual([companions[0], { ...companions[1], allergies: '' }]);
    send.mockReset().mockResolvedValue({ Item: item });
    expect((await invoke({ ...valid, companions })).statusCode).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('同伴者の必須項目と人数の上限を検証する', async () => {
    const guest = { name: '山田 太郎', kana: 'やまだ たろう', attendance: 'attending', allergies: 'あ'.repeat(500) };
    send.mockResolvedValue({});
    expect((await invoke({ ...valid, companions: Array(9).fill(guest) })).statusCode).toBe(201);
    send.mockClear();
    for (const companions of [[{ ...guest, name: ' ' }], [{ ...guest, kana: '' }], [{ ...guest, attendance: 'unknown' }], Array(10).fill(guest)]) {
      expect((await invoke({ ...valid, companions })).statusCode).toBe(400);
    }
    expect(send).not.toHaveBeenCalled();
  });
  it('ゲスト区分と住所を保存し、不正な区分・郵便番号を拒否する', async () => {
    const additions = { guestSide: 'bride', postalCode: '123-4567', address: '東京都〇〇区 1-1-1', building: 'テストマンション101' };
    send.mockResolvedValue({});
    expect((await invoke({ ...valid, ...additions })).statusCode).toBe(201);
    expect(send.mock.calls[1][0].input.TransactItems[1].Put.Item).toMatchObject(additions);
    expect(responseSchema.safeParse({ ...valid, postalCode: '1234567' }).success).toBe(true);
    expect(responseSchema.safeParse({ ...valid, postalCode: '' }).success).toBe(true);
    send.mockClear();
    for (const extra of [{ guestSide: 'unknown' }, { postalCode: '123' }, { postalCode: 'abcdefg' }, { address: 'a'.repeat(201) }]) {
      expect((await invoke({ ...valid, ...extra })).statusCode).toBe(400);
    }
    expect(send).not.toHaveBeenCalled();
  });
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
  it('不正なメール・未知の項目を拒否する', async () => {
    for (const body of [{ ...valid, email: 'invalid' }, { ...valid, admin: true }]) expect((await invoke(body)).statusCode).toBe(400);
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
  it('同じトークンで異なる回答を別レコードとして保存する', async () => {
    const items = new Map<string, Record<string, unknown>>();
    send.mockImplementation(async command => {
      if (command.input.Key) return { Item: items.get(command.input.Key.pk) };
      const item = command.input.TransactItems[1].Put.Item;
      items.set(item.pk, item);
      return {};
    });
    expect((await invoke(valid)).statusCode).toBe(201);
    expect((await invoke({ ...valid, attendance: 'declining' })).statusCode).toBe(201);
    expect((await invoke({ ...valid, name: '山田 太郎' })).statusCode).toBe(201);
    expect(items.size).toBe(3);
    expect([...items.values()].map(item => item.attendance)).toEqual(['attending', 'declining', 'attending']);
    expect((await invoke(valid)).statusCode).toBe(200);
    expect(items.size).toBe(3);
  });
  it('同時再送で保存済みになった回答も成功として扱う', async () => {
    send.mockResolvedValueOnce({}).mockRejectedValueOnce(Object.assign(new Error('cancelled'), { name: 'TransactionCanceledException' })).mockResolvedValueOnce({ Item: { payloadHash: 'saved' } });
    expect((await invoke(valid)).statusCode).toBe(200);
  });
  it('未発行・失効した招待リンクを拒否する', async () => {
    send.mockResolvedValueOnce({}).mockRejectedValueOnce(Object.assign(new Error('cancelled'), { name: 'TransactionCanceledException' })).mockResolvedValueOnce({});
    expect((await invoke(valid)).statusCode).toBe(403);
  });
  it('不正JSONと大きすぎるリクエストを拒否する', async () => {
    expect((await invoke(null, { body: '{' })).statusCode).toBe(400);
    expect((await invoke(null, { body: 'a'.repeat(64001) })).statusCode).toBe(413);
    expect(send).not.toHaveBeenCalled();
  });
  it('ストレージ障害を登録成功として扱わない', async () => {
    send.mockRejectedValue(new Error('unavailable'));
    expect((await invoke(valid)).statusCode).toBe(503);
  });
});
