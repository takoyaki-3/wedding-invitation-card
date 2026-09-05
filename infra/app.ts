import { App } from 'aws-cdk-lib';
import { WeddingStack } from './wedding-stack';

const app = new App();
new WeddingStack(app, 'WeddingInvitation', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1' }
});
