import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as CdkCloudFrontEc2 from '../lib/cdk-cloudfront-ec2-stack';

test('CloudFront with EC2 Origin Resources', () => {
  const app = new cdk.App();
  // スタック環境を指定
  const env = { 
    account: '123456789012', // テスト用のダミーアカウント
    region: 'us-east-1'      // テスト用のダミーリージョン（CloudFrontはus-east-1にデプロイされる）
  };
  
  // WHEN
  const stack = new CdkCloudFrontEc2.CdkCloudFrontEc2Stack(app, 'MyTestStack', { env });
  
  // THEN
  const template = Template.fromStack(stack);

  // S3ログバケットの検証
  template.hasResourceProperties('AWS::S3::Bucket', {
    AccessControl: 'LogDeliveryWrite',
    BucketName: Match.stringLikeRegexp('cloudfront-log-example-\\d+\\.com')
  });

  // カスタムキャッシュポリシーの検証
  template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
    CachePolicyConfig: {
      DefaultTTL: 300, // 5分
      MinTTL: 1,
      MaxTTL: 31536000, // 365日
      ParametersInCacheKeyAndForwardedToOrigin: {
        CookiesConfig: {
          CookieBehavior: 'none'
        },
        HeadersConfig: {
          HeaderBehavior: 'none'
        },
        QueryStringsConfig: {
          QueryStringBehavior: 'all'
        },
        EnableAcceptEncodingBrotli: true,
        EnableAcceptEncodingGzip: true
      }
    }
  });

  // CloudFrontディストリビューションの検証
  template.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: {
      // デフォルトビヘイビアの検証
      DefaultCacheBehavior: {
        ViewerProtocolPolicy: 'redirect-to-https',
        AllowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE'],
        CachedMethods: ['GET', 'HEAD'],
        Compress: true
      },
      // 追加ビヘイビアの検証
      CacheBehaviors: Match.arrayWith([
        Match.objectLike({
          PathPattern: '/images/*',
          AllowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE'],
          CachedMethods: ['GET', 'HEAD']
        })
      ]),
      // Origin設定の検証
      Origins: Match.arrayWith([
        Match.objectLike({
          DomainName: Match.stringLikeRegexp('ec2-.*\\.ap-northeast-1\\.compute\\.amazonaws\\.com'),
          CustomOriginConfig: {
            OriginProtocolPolicy: 'http-only',
            OriginShieldEnabled: true,
            OriginShieldRegion: 'ap-northeast-1'
          }
        })
      ]),
      Enabled: true,
      PriceClass: 'PriceClass_ALL',
      // ログ設定の検証
      Logging: {
        Bucket: {
          'Fn::GetAtt': Match.arrayWith([
            Match.stringLikeRegexp('LogBucket'),
            'DomainName'
          ])
        },
        Prefix: 'example-20240417.com'
      }
    }
  });

  // 出力の検証
  template.hasOutput('DistributionId', {
    Description: 'CloudFrontディストリビューションのID'
  });
});
