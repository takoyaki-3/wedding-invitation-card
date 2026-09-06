import { createHash } from 'node:crypto';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { responseSchema } from '../../shared/validation';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
const reply = (statusCode: number, message: string) => ({ statusCode, headers, body: JSON.stringify({ message }) });

export const handler: APIGatewayProxyHandlerV2 = async event => {
  if (event.requestContext.http.method === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.requestContext.http.method !== 'POST') return reply(405, 'この操作は対応していません。');
  const contentType = event.headers['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('application/json')) return reply(415, 'JSON形式で送信してください。');
  const body = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
  if (Buffer.byteLength(body) > 12000) return reply(413, '入力内容が長すぎます。');
  let raw: unknown;
  try { raw = JSON.parse(body); } catch { return reply(400, '入力内容をご確認ください。'); }
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) return reply(400, '入力内容、同意事項、招待リンクをご確認ください。');
  const { token, website: _website, ...response } = parsed.data;
  if (response.attendance === 'declining') response.allergies = '';
  const digest = hash(token);
  const pk = `RSVP#${digest}`;
  const payloadHash = hash(JSON.stringify(response));
  const table = process.env.TABLE_NAME!;
  try {
    // A retry after a lost HTTP response returns success without a second write or email.
    const existing = await db.send(new GetCommand({ TableName: table, Key: { pk }, ConsistentRead: true }));
    if (existing.Item) return existing.Item.payloadHash === payloadHash ? reply(200, '回答を受け付けました。') : reply(409, 'この招待状は回答済みです。変更は新郎新婦へご連絡ください。');
    const now = Date.now();
    const deadline = Date.parse(process.env.RSVP_DEADLINE || '');
    if (!Number.isFinite(deadline)) return reply(503, '受付設定を確認中です。しばらくしてからお試しください。');
    if (now > deadline) return reply(410, '回答期限を過ぎています。新郎新婦へ直接ご連絡ください。');
    await db.send(new TransactWriteCommand({ TransactItems: [
      { ConditionCheck: { TableName: table, Key: { pk: `INVITE#${digest}` }, ConditionExpression: 'attribute_exists(pk) AND expiresAt > :now AND (attribute_not_exists(disabled) OR disabled = :false)', ExpressionAttributeValues: { ':now': Math.floor(now / 1000), ':false': false } } },
      { Put: { TableName: table, Item: { pk, ...response, payloadHash, createdAt: new Date(now).toISOString(), guestMailSent: false, hostMailSent: false, expiresAt: Math.floor(deadline / 1000) + 180 * 86400 }, ConditionExpression: 'attribute_not_exists(pk)' } }
    ] }));
    return reply(201, '回答を受け付けました。');
  } catch (err) {
    if (err instanceof Error && err.name === 'TransactionCanceledException') {
      // Concurrent retries can race the initial read; inspect the committed result.
      try {
        const existing = await db.send(new GetCommand({ TableName: table, Key: { pk }, ConsistentRead: true }));
        if (existing.Item) return existing.Item.payloadHash === payloadHash ? reply(200, '回答を受け付けました。') : reply(409, 'この招待状は回答済みです。変更は新郎新婦へご連絡ください。');
      } catch { return reply(503, '一時的に受付できません。同じ内容で再度お試しください。'); }
      return reply(403, '招待リンクが無効または期限切れです。新郎新婦へご連絡ください。');
    }
    // Do not put names, addresses, allergy information or invitation tokens in logs.
    console.error('RSVP storage failed', err instanceof Error ? err.name : 'UnknownError');
    return reply(503, '一時的に受付できません。同じ内容で再度お試しください。');
  }
};
