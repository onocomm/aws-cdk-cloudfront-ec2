#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkCloudFrontEc2Stack } from '../lib/cdk-cloudfront-ec2-stack';

const envName = process.env.CDK_ENV || 'production';

const app = new cdk.App();
const config = app.node.tryGetContext(envName);

if (!config) {
  throw new Error(`Environment ${envName} is not defined in cdk.json`);
}

new CdkCloudFrontEc2Stack(app, `CdkCloudFrontEc2Stack-${config.ResourceName}`, {
  ...config,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  }
});
