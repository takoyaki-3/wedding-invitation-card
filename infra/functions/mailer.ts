import type { DynamoDBStreamHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { weddingSchema } from '../../shared/wedding';
import { renderEmail } from './email-template';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = new SESv2Client({});

export const handler: DynamoDBStreamHandler = async event => {
  const wedding = weddingSchema.parse(JSON.parse(process.env.WEDDING_CONFIG || '{}'));
  for (const record of event.Records) {
    const pk = record.dynamodb?.Keys?.pk.S;
    if (!pk?.startsWith('RSVP#') || record.eventName !== 'INSERT') continue;
    const { Item: response } = await db.send(new GetCommand({ TableName: process.env.TABLE_NAME, Key: { pk }, ConsistentRead: true }));
    if (!response) continue;
    const attendance = response.attendance === 'attending' ? 'ご出席' : 'ご欠席';
    const details = [
      `ご出欠：${attendance}`, `お名前：${response.name}`, `ふりがな：${response.kana}`, `メールアドレス：${response.email || '未登録'}`,
      ...(response.attendance === 'attending' ? [`アレルギー・お食事：${response.allergies || 'なし'}`] : []),
      `メッセージ：${response.message || 'なし'}`, '',
      `会場：${wedding.venueJapanese}`, `住所：${wedding.address}`,
      ...(wedding.date ? [`挙式日時：${new Intl.DateTimeFormat('ja-JP', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Tokyo' }).format(new Date(wedding.date))}`] : ['挙式日時：後日ご案内']),
    ].join('\n');
    const copy = [`${response.name} 様`, '', '結婚式の出欠をご回答いただき、ありがとうございます。', '以下の内容で受け付けました。', '', details, '', `変更・お問い合わせ：${wedding.contactEmail}`, '', `${wedding.groomJapanese}・${wedding.brideJapanese}`].join('\n');
    const hostCopy = ['新しい出欠回答を受け付けました。', '', details, '', `受付日時：${response.createdAt || '未記録'}`].join('\n');
    const destinations = [
      { email: response.email as string, flag: 'guestMailSent', subject: '【結婚式のご招待】出欠回答のコピー', body: copy },
      { email: process.env.GROOM_EMAIL, flag: 'groomMailSent', subject: '【結婚式】新しい出欠回答が届きました', body: `${wedding.groomJapanese} 様\n\n${hostCopy}` },
      { email: process.env.BRIDE_EMAIL, flag: 'brideMailSent', subject: '【結婚式】新しい出欠回答が届きました', body: `${wedding.brideJapanese} 様\n\n${hostCopy}` },
      { email: process.env.HOST_EMAIL, flag: 'hostMailSent', subject: '【結婚式】新しい出欠回答が届きました', body: hostCopy }
    ];
    const failures: Error[] = [];
    for (const destination of destinations) {
      if (!destination.email || response[destination.flag]) continue;
      try {
      await ses.send(new SendEmailCommand({
        FromEmailAddress: process.env.SENDER_EMAIL,
        ConfigurationSetName: process.env.SES_CONFIGURATION_SET || undefined,
        Destination: { ToAddresses: [destination.email] },
        ReplyToAddresses: [wedding.contactEmail],
        Content: { Simple: { Subject: { Data: destination.subject, Charset: 'UTF-8' }, Body: {
          Text: { Data: destination.body, Charset: 'UTF-8' },
          Html: { Data: renderEmail(wedding, destination.body, destination.flag === 'guestMailSent'), Charset: 'UTF-8' }
        } } }
      }));
      await db.send(new UpdateCommand({ TableName: process.env.TABLE_NAME, Key: { pk }, UpdateExpression: 'SET #flag = :true', ConditionExpression: 'attribute_exists(pk)', ExpressionAttributeNames: { '#flag': destination.flag }, ExpressionAttributeValues: { ':true': true } }));
      } catch {
        // Continue delivering to the other recipients; omit personal data from logs.
        failures.push(new Error(`Delivery failed: ${destination.flag}`));
      }
    }
    if (failures.length) throw new AggregateError(failures, 'One or more notification deliveries failed');
  }
};
