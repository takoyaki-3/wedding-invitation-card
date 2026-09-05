import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-lambda-event-sources';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as deployment from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { loadEnvironment } from '../config/environment';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export class WeddingStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const { wedding, ses: settings } = loadEnvironment();
    const sender = this.node.tryGetContext('senderEmail') || settings.senderEmail;
    const hostEmail = this.node.tryGetContext('hostEmail') || settings.hostEmail;
    const configurationSetName = this.node.tryGetContext('sesConfigurationSetName') || settings.configurationSetName;
    const domain = this.node.tryGetContext('sesIdentityDomain') || settings.identityDomain;
    const existingIdentityArn = this.node.tryGetContext('sesIdentityArn') || settings.identityArn || (domain ? this.formatArn({ service: 'ses', resource: 'identity', resourceName: domain }) : undefined);
    const identity = existingIdentityArn
      ? ses.EmailIdentity.fromEmailIdentityArn(this, 'Sender', existingIdentityArn)
      : new ses.EmailIdentity(this, 'Sender', { identity: ses.Identity.email(sender) });

    const table = new dynamodb.Table(this, 'Responses', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.RETAIN
    });
    const deadLetters = new sqs.Queue(this, 'EmailFailures', {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(14),
      enforceSSL: true
    });
    const makeFunction = (name: string, file: string, extra: Record<string, string> = {}) => new NodejsFunction(this, name, {
      entry: path.join(root, 'infra/functions', file),
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(30),
      bundling: { minify: true, sourceMap: true, externalModules: [] },
      logGroup: new logs.LogGroup(this, `${name}Logs`, { retention: logs.RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY }),
      environment: { TABLE_NAME: table.tableName, ...extra }
    });
    const register = makeFunction('RegisterRsvp', 'rsvp.ts', { RSVP_DEADLINE: wedding.deadline });
    const mailer = makeFunction('SendCopy', 'mailer.ts', { SENDER_EMAIL: sender, HOST_EMAIL: hostEmail, GROOM_EMAIL: settings.groomEmail, BRIDE_EMAIL: settings.brideEmail, SES_CONFIGURATION_SET: configurationSetName, WEDDING_CONFIG: JSON.stringify(wedding) });
    table.grantReadWriteData(register);
    table.grantReadWriteData(mailer);
    const sendResources = [identity.emailIdentityArn];
    if (configurationSetName) sendResources.push(this.formatArn({ service: 'ses', resource: 'configuration-set', resourceName: configurationSetName }));
    mailer.addToRolePolicy(new iam.PolicyStatement({ actions: ['ses:SendEmail'], resources: sendResources, conditions: { StringEquals: { 'ses:FromAddress': sender } } }));
    mailer.addEventSource(new events.DynamoEventSource(table, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      batchSize: 1,
      retryAttempts: 10,
      maxRecordAge: Duration.hours(23),
      bisectBatchOnError: true,
      onFailure: new events.SqsDlq(deadLetters),
      filters: [lambda.FilterCriteria.filter({ eventName: ['INSERT'], dynamodb: { Keys: { pk: { S: [{ prefix: 'RSVP#' }] } } } })]
    }));
    new cloudwatch.Alarm(this, 'EmailFailureAlarm', { metric: deadLetters.metricApproximateNumberOfMessagesVisible(), threshold: 1, evaluationPeriods: 1, alarmDescription: '回答コピーの送信に失敗しました。DynamoDBの回答とEmailFailuresキューを確認してください。', treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING });

    const api = new apigw.HttpApi(this, 'Api');
    api.addRoutes({ path: '/api/rsvp', methods: [apigw.HttpMethod.POST], integration: new HttpLambdaIntegration('RegisterIntegration', register) });
    const stage = api.defaultStage!.node.defaultChild as apigw.CfnStage;
    stage.defaultRouteSettings = { throttlingBurstLimit: 10, throttlingRateLimit: 2 };

    const bucket = new s3.Bucket(this, 'Website', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN
    });
    const securityHeaders = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.NO_REFERRER, override: true },
        strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: true, override: true },
        contentSecurityPolicy: { contentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://images.unsplash.com data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'", override: true }
      }
    });
    const siteOrigin = origins.S3BucketOrigin.withOriginAccessControl(bucket);
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: { origin: siteOrigin, viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, responseHeadersPolicy: securityHeaders },
      additionalBehaviors: {
        'config.json': { origin: siteOrigin, viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, responseHeadersPolicy: securityHeaders },
        'api/*': { origin: new origins.HttpOrigin(`${api.apiId}.execute-api.${this.region}.${this.urlSuffix}`), viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY, allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL, cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER, responseHeadersPolicy: securityHeaders }
      }
    });
    const rsvpEndpoint = `https://${distribution.distributionDomainName}/api/rsvp`;
    new deployment.BucketDeployment(this, 'PublishWebsite', {
      destinationBucket: bucket,
      sources: [deployment.Source.asset(path.join(root, 'dist')), deployment.Source.jsonData('config.json', { demo: false, rsvpEndpoint })],
      distribution,
      retainOnDelete: true,
      distributionPaths: ['/*']
    });
    new CfnOutput(this, 'WebsiteUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'RsvpEndpoint', { value: rsvpEndpoint });
    new CfnOutput(this, 'TableName', { value: table.tableName });
    new CfnOutput(this, 'EmailFailureQueueUrl', { value: deadLetters.queueUrl });
    new CfnOutput(this, 'MailerFunctionName', { value: mailer.functionName });
    new CfnOutput(this, 'SenderIdentity', { value: identity.emailIdentityArn });
  }
}
