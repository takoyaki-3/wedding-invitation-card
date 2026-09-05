# Wedding Invitation

React / TypeScript / Vite と AWS CDK v2 で構成した結婚式のWeb招待状です。出欠をDynamoDBに保存し、任意のメールアドレスを登録した方にだけSESで回答のコピーを送信します。

## 初期設定・ローカルプレビュー

Node.js 22以上を使用します。初回はサンプルをコピーし、実際の内容を設定してください。すでに `.env.local` がある場合はコピーせず、そのファイルを編集します。

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

http://localhost:5173 を開きます。停止は `Ctrl + C`。ローカルはプレビューモードで、回答の保存・メール送信・ブラウザへの個人情報保存は行いません。

## 環境変数ファイル

**実際の名前、式場、住所、日時、メールアドレス、SES設定は `.env.local` に記載します。** `.env` と `.env.*` はGit管理対象外です。コミットするのは架空の設定例を記載した `.env.example` のみです。旧 `wedding.config.json` は廃止しました。

読み込みの優先順位は、シェル・CIの環境変数 → `.env.local` → `.env` です。Vite・CDK・招待リンク発行スクリプトが共通のローダーを使用します。必須項目が不足している場合はエラーになります。

| 環境変数 | 用途 |
| --- | --- |
| `WEDDING_GROOM` / `WEDDING_BRIDE` | 英字のお名前 |
| `WEDDING_GROOM_JAPANESE` / `WEDDING_BRIDE_JAPANESE` | 日本語のお名前 |
| `WEDDING_DATE` / `WEDDING_END_DATE` | 挙式開始・終了日時。未定なら空欄 |
| `WEDDING_DEADLINE` | 出欠回答締切。必須 |
| `WEDDING_RECEPTION_TIME` / `WEDDING_CEREMONY_TIME` / `WEDDING_PARTY_TIME` | 受付・挙式・披露宴の開始時刻。空欄なら「後日ご案内」 |
| `WEDDING_VENUE` / `WEDDING_VENUE_JAPANESE` | 英字・日本語の会場名 |
| `WEDDING_ADDRESS` / `WEDDING_ACCESS` / `WEDDING_MAP_QUERY` | 住所・アクセス案内・地図検索語 |
| `WEDDING_CONTACT_EMAIL` | 招待状とメール本文の問い合わせ先 |
| `SES_SENDER_EMAIL` | 送信元。空欄なら問い合わせ先を使用 |
| `SES_IDENTITY_DOMAIN` / `SES_IDENTITY_ARN` | 認証済みSES ID。ARNを優先 |
| `SES_CONFIGURATION_SET_NAME` | 使用するSES設定セット。不要なら空欄 |
| `RSVP_HOST_EMAIL` | 主催者への通知先。空欄なら通知なし |

日時は `2099-10-22T11:00:00+09:00` のようにタイムゾーン込みで指定してください。値に空白や `#` がある場合はダブルクォートで囲みます。開始・終了日時が設定されるとカレンダーへの追加が表示されます。

設定変更後は開発サーバーを再起動してください。本番への反映には再ビルド・再デプロイが必要です。メール処理にはCDKからLambda環境変数 `WEDDING_CONFIG` として設定を渡します。

Git管理から外しても、**招待状に表示する名前・式場・日時・問い合わせ先は公開サイトの配信ファイルに含まれます**。フロントエンドには明示した公開項目だけを埋め込み、SES設定・主催者の通知先・AWS認証情報は埋め込みません。`.env.local` を `public/` に置かないでください。生成物の `dist/`、`cdk.out/`、`cdk-outputs.json`、テストのスクリーンショットもGit管理対象外です。

## 検証

```powershell
npm run build
npm test
npm run synth -- --quiet
npm run test:e2e
```

ブラウザテストはEdgeを使います。別のブラウザを使う場合は `playwright.config.ts` の `channel` を変更してください。ユニットテストは `.env.example` の架空の値で動作し、実際の個人情報を必要としません。ブラウザテストは起動中アプリと同じ環境設定を参照します。

## AWS構成・デプロイ

```mermaid
flowchart LR
  Guest[ゲスト] --> CF[CloudFront / HTTPS]
  CF --> S3[非公開 S3 / 招待状]
  CF --> API[API Gateway / POST api/rsvp]
  API --> Register[Lambda / 出欠受付]
  Register --> DB[(DynamoDB / 招待・回答)]
  DB --> Stream[DynamoDB Streams]
  Stream --> Mail[Lambda / 回答コピー]
  Mail --> SES[Amazon SES]
  SES --> Recipient[メール登録者]
  Stream --> DLQ[SQS / 送信失敗記録]
```

AWS CLIの認証とCDKデプロイ権限がある環境で実行します。AWSの利用料金が発生します。

```powershell
$env:AWS_PROFILE = 'your-profile'
$env:AWS_REGION = 'ap-northeast-1'
$env:CDK_DEFAULT_REGION = 'ap-northeast-1'
# CDKの基盤がないアカウント・リージョンで初回のみ実行
npx cdk bootstrap aws://YOUR_ACCOUNT_ID/ap-northeast-1
npm run deploy
```

公開URLはデプロイの `WebsiteUrl` 出力、または管理対象外の `cdk-outputs.json` で確認できます。スタック名は `WeddingInvitation` です。本番の `runtime-config.json` はデプロイ時に自動設定されます。

SES IDを指定しなければ送信元のメールアドレスIDを作成するので、届いた確認メールで認証を完了してください。既存のドメイン・IDを使う場合は環境変数に設定します。既存IDに既定の設定セットがある場合は `SES_CONFIGURATION_SET_NAME` も設定してください。CDKは指定されたIDと設定セットに限定して送信を許可します。

ゲストの任意アドレスへ送るには、利用リージョンで[SESの本番アクセス](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)が必要です。[SESのID認証](https://docs.aws.amazon.com/ses/latest/dg/verify-addresses-and-domains.html)も確認してください。SESは受信メールボックスを作成しないため、問い合わせ先の受信設定は既存のメールサービス側で行います。

従来のCDKコンテキスト `senderEmail`、`hostEmail`、`sesIdentityDomain`、`sesIdentityArn`、`sesConfigurationSetName` による上書きも可能ですが、実際の値を `cdk.json` に書き込まず、環境変数ファイルで管理してください。

## 招待リンク・回答の管理

```powershell
npm run invite -- "ゲストのお名前"
```

表示される専用URLをゲストに個別にお渡しください。コマンドは招待レコードとURLを作成するだけで、招待メールを送信しません。リンク発行時のメールアドレスは不要です。

1リンクにつき1名・1回答です。同じ内容の再送は成功として扱い、別の内容で上書きしません。変更は新郎新婦への連絡を案内します。同じ方への再発行は新しい回答権限を作るため、旧招待レコードの `disabled` を `true` にしてから行ってください。

回答はDynamoDBコンソールで、出力 `TableName` の `pk` が `RSVP#` から始まるレコードを確認します。管理者用の公開Web画面はありません。

- 招待トークンは256ビットで生成し、ハッシュのみを保存します。URLフラグメントを画面読み込み後に除去するため、再読み込みした際は元の招待リンクを開き直してください。
- トランザクションで招待状の有効期限・失効状態を検証します。APIには入力検証・12KBの入力上限・毎秒2件／バースト10件のスロットリングがあります。
- 回答は締切180日後にTTL削除対象となります。実削除には遅延があります。DynamoDBのPITRを有効化し、テーブルとS3はスタック削除後も保持するため、運用終了時に保持・削除を判断してください。

## メールの再試行・疎通確認

回答保存後、DynamoDB StreamsからSES送信処理を実行します。メール未入力ならゲストへの送信を行いません。障害時は最大10回再試行し、処理できないイベントをSQSに保存します。CloudWatchアラームの通知先アクションは未設定のため、必要に応じてSNS等を接続してください。

SES受理と送信済みフラグの保存は別処理なので、その間の障害ではコピーが重複する可能性があります。SES受理は受信箱への配送保証ではありません。バウンス・苦情はSES側で確認してください。

障害解消後、対象回答と `guestMailSent` を確認し、出力 `MailerFunctionName` のLambdaを以下のテストイベントで再実行できます。

```json
{"Records":[{"eventName":"INSERT","dynamodb":{"Keys":{"pk":{"S":"RSVP#対象回答のハッシュ"}}}}]}
```

`npx tsx scripts/smoke-live.ts` は実AWSに使い捨ての回答を保存し、AWSシミュレーターへのメール送信を検証します。この実行のテストレコードは終了時に削除します。`npx tsx scripts/check-live-ui.ts` は公開URLの表示を検証します。いずれも `cdk-outputs.json` を参照します。

写真は `public/` に同梱したイメージ写真で、実際の会場写真ではありません。Google Fontsの表示には外部ネットワーク接続を使います。
