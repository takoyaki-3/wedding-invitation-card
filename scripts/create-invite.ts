import { randomBytes, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { loadEnvironment } from '../config/environment';
import { createInviteUrl, parseInviteArgs } from '../shared/invitation';

const { wedding } = loadEnvironment();

const { name, label, group } = parseInviteArgs(process.argv.slice(2));
const outputs = JSON.parse(await readFile('cdk-outputs.json', 'utf8')).WeddingInvitation;
if (!outputs?.TableName || !outputs?.WebsiteUrl) throw new Error('デプロイ結果 cdk-outputs.json が見つかりません');
const expiresAt = Math.floor(Date.parse(wedding.deadline) / 1000);
if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() / 1000) throw new Error('回答締切を確認してください');
const token = randomBytes(32).toString('base64url');
const digest = createHash('sha256').update(token).digest('hex');
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1' }));
await db.send(new PutCommand({ TableName: outputs.TableName, Item: { pk: `INVITE#${digest}`, guestName: name, expiresAt, disabled: false, createdAt: new Date().toISOString() }, ConditionExpression: 'attribute_not_exists(pk)' }));
console.log(`招待リンク（${name} 様・${label}）\n${createInviteUrl(outputs.WebsiteUrl, token, group)}\nこのリンクを対象のゲストに個別にお渡しください。`);
