import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as CdkCloudFrontEc2 from '../lib/cdk-cloudfront-ec2-stack';

test('CloudFront with WAF and EC2 Origin Resources', () => {
  const app = new cdk.App();
  // スタック環境を指定
  const env = { 
    account: '123456789012', // テスト用のダミーアカウント
    region: 'us-east-1'      // テスト用のダミーリージョン
  };
  
  // WHEN
  const stack = new CdkCloudFrontEc2.CdkCloudFrontEc2Stack(app, 'MyTestStack', { 
    EC2InstanceId: 'i-testinstance12345',
    env 
  } as any);
  
  // THEN
  const template = Template.fromStack(stack);

  // WAFリソースの検証
  template.hasResourceProperties('AWS::WAFv2::WebACL', {
    DefaultAction: {
      Allow: {}
    },
    Scope: 'CLOUDFRONT',
    VisibilityConfig: {
      CloudWatchMetricsEnabled: true,
      MetricName: 'WebACL',
      SampledRequestsEnabled: true
    },
    Rules: Match.arrayWith([
      // レートベースルールの検証
      Match.objectLike({
        Name: 'RateBasedRule',
        Priority: 1,
        Action: {
          Block: {}
        },
        Statement: {
          RateBasedStatement: {
            Limit: 100,
            AggregateKeyType: 'IP'
          }
        }
      }),
      // SQLインジェクション対策ルールの検証
      Match.objectLike({
        Name: 'SQLiRule',
        Priority: 2,
        Statement: {
          ManagedRuleGroupStatement: {
            Name: 'AWSManagedRulesSQLiRuleSet',
            VendorName: 'AWS'
          }
        }
      }),
      // 一般的なWebアプリケーション脆弱性対策ルールの検証
      Match.objectLike({
        Name: 'CommonRule',
        Priority: 3,
        Statement: {
          ManagedRuleGroupStatement: {
            Name: 'AWSManagedRulesCommonRuleSet',
            VendorName: 'AWS'
          }
        }
      })
    ])
  });

  // CloudFrontディストリビューションの検証
  template.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: {
      DefaultCacheBehavior: {
        ViewerProtocolPolicy: 'redirect-to-https',
        OriginRequestPolicyId: {
          'Fn::GetAtt': Match.anyValue()
        },
        CachePolicyId: {
          'Fn::GetAtt': Match.anyValue()
        }
      },
      Enabled: true,
      WebACLId: {
        'Fn::GetAtt': Match.arrayWith([
          Match.stringLikeRegexp('WebACL'),
          'Arn'
        ])
      },
      PriceClass: 'PriceClass_100'
    }
  });

  // 出力の検証
  template.hasOutput('DistributionDomainName', {});
  template.hasOutput('WebACLId', {});
  template.hasOutput('EC2InstanceId', {
    Value: 'i-testinstance12345'
  });
});
