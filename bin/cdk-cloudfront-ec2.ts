#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkCloudFrontEc2Stack } from '../lib/cdk-cloudfront-ec2-stack';

const app = new cdk.App();

new CdkCloudFrontEc2Stack(app, 'CdkCloudFrontEc2Stack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  }
});
