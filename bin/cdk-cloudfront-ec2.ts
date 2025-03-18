#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkCloudFrontEc2Stack } from '../lib/cdk-cloudfront-ec2-stack';

// AWSアカウントとリージョンを指定
const app = new cdk.App();
new CdkCloudFrontEc2Stack(app, 'CdkCloudFrontEc2Stack', {
  ResourceName: 'CdkCloudFrontEc2',
  alternateDomainNames: [''],
  certificateArn: '',
  OriginDomain: 'ec2-18-181-109-95.ap-northeast-1.compute.amazonaws.com',
  whiteListIpSetArn: '',
  logEnabled: false,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  }
});
