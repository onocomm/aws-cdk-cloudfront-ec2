import { Stack, StackProps, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

// カスタムプロパティの型を定義
interface CdkStackProps extends StackProps {
  ResourceName: string;
  alternateDomainNames: string[];
  certificateArn: string;
  OriginDomain: string;
  whiteListIpSetArn: string;
  logEnabled: boolean;
}

export class CdkCloudFrontEc2Stack extends Stack {
  constructor(scope: Construct, id: string, props: CdkStackProps) {
    super(scope, id, props);

    // ✅ props が undefined の場合、エラーを回避
    if (!props) {
      throw new Error('props is required for CdkEc2Stack');
    }
    
    const {
      ResourceName,
      alternateDomainNames,
      certificateArn,
      OriginDomain,
      whiteListIpSetArn,
      logEnabled,
    } = props as CdkStackProps;

    // ✅ CloudFront 用 WAF WebACL を作成
    const webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
      name: `${ResourceName}-WebACL`,
      defaultAction: { allow: {} },
      scope: 'CLOUDFRONT',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${ResourceName}-WebACL-Metrics`,
        sampledRequestsEnabled: true,
      },
      rules: [
        // ✅ ホワイトリスト (IPSet)
        ...(whiteListIpSetArn
          ? [{
              name: 'WhiteList',
              priority: 0,
              action: { allow: {} },
              statement: {
                ipSetReferenceStatement: {
                  arn: whiteListIpSetArn,
                },
              },
              visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: 'WhiteList-Metrics',
                sampledRequestsEnabled: true,
              },
            }]
          : []),
        // ✅ AWS マネージドルール
        {
          name: 'AWSManagedRulesAdminProtectionRuleSet',
          priority: 1,
          statement: {
            managedRuleGroupStatement: {
              name: 'AWSManagedRulesAdminProtectionRuleSet',
              vendorName: 'AWS',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AdminProtectionRuleSet-Metrics',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedRulesAmazonIpReputationList',
          priority: 2,
          statement: {
            managedRuleGroupStatement: {
              name: 'AWSManagedRulesAmazonIpReputationList',
              vendorName: 'AWS',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AmazonIpReputationList-Metrics',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedRulesAnonymousIpList',
          priority: 3,
          statement: {
            managedRuleGroupStatement: {
              name: 'AWSManagedRulesAnonymousIpList',
              vendorName: 'AWS',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AnonymousIpList-Metrics',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 4,
          statement: {
            managedRuleGroupStatement: {
              name: 'AWSManagedRulesCommonRuleSet',
              vendorName: 'AWS',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSet-Metrics',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 5,
          statement: {
            managedRuleGroupStatement: {
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
              vendorName: 'AWS',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'KnownBadInputsRuleSet-Metrics',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedRulesLinuxRuleSet',
          priority: 6,
          statement: {
            managedRuleGroupStatement: {
              name: 'AWSManagedRulesLinuxRuleSet',
              vendorName: 'AWS',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'LinuxRuleSet-Metrics',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedRulesPHPRuleSet',
          priority: 7,
          statement: {
            managedRuleGroupStatement: {
              name: 'AWSManagedRulesPHPRuleSet',
              vendorName: 'AWS',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'PHPRuleSet-Metrics',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedRulesUnixRuleSet',
          priority: 8,
          statement: {
            managedRuleGroupStatement: {
              name: 'AWSManagedRulesUnixRuleSet',
              vendorName: 'AWS',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'UnixRuleSet-Metrics',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedRulesSQLiRuleSet',
          priority: 9,
          statement: {
            managedRuleGroupStatement: {
              name: 'AWSManagedRulesSQLiRuleSet',
              vendorName: 'AWS',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'SQLiRuleSet-Metrics',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    // ✅ WAF ログ設定（CloudWatch Logs に出力）
    if(logEnabled){
      new wafv2.CfnLoggingConfiguration(this, 'WafLoggingConfig', {
        logDestinationConfigs: [(new logs.LogGroup(this, 'WafLogGroup', {
          logGroupName: `aws-waf-logs-${ResourceName}`,
          removalPolicy: RemovalPolicy.RETAIN, // ログの保持設定（削除しない）
        })).logGroupArn], // ✅ CloudWatch Logs を設定
        resourceArn: webAcl.attrArn,
      });
    }
    
    // CloudFrontディストリビューションの作成
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.HttpOrigin(OriginDomain, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY, // HTTP経由でオリジンと通信
          originShieldEnabled: true,
          originShieldRegion: 'ap-northeast-1',
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // ビューワーからのHTTPリクエストをHTTPSにリダイレクト
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL, // ✅ GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE を許可
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED, // キャッシュ最適化のためのポリシー
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022, // ビューワーからのすべてのヘッダーをオリジンにリレー
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT, // ✅ SimpleCORS を設定
      },
      // WAFをアタッチ
      webAclId: webAcl.attrArn,
      // 他の設定
      comment: `CloudFront distribution for ${ResourceName}`,
      // 料金クラス（北米、欧州のみ）
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      // 有効
      enabled: true,
      // 代替ドメイン名（CNAME）を指定
      ...(alternateDomainNames?.[0] &&
        { domainNames: alternateDomainNames }),
      // ACM証明書を指定
      ...(certificateArn &&
          { certificate: certificatemanager.Certificate.fromCertificateArn(this, 'Certificate', certificateArn) } ),
      // ログ保存用のS3バケットを指定
      ...(logEnabled &&
          { logBucket:  new s3.Bucket(this, 'CloudFrontLogBucket', {
              bucketName: `${ResourceName.toLowerCase()}-cloudfront-log`,
              removalPolicy: RemovalPolicy.RETAIN, // ログの保持
              accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE, // CloudFront からのログ書き込み許可
            }
          )}),
    });

    // 出力 - デプロイ後に参照できる情報
    new CfnOutput(this, 'DistributionDomainName', {
      description: 'CloudFrontディストリビューションのドメイン名',
      value: distribution.distributionDomainName,
    });

    new CfnOutput(this, 'WebACLId', {
      description: 'WAF Web ACLのID',
      value: webAcl.attrId,
    });
    
    new CfnOutput(this, 'OriginDomain', {
      description: 'オリジンドメイン',
      value: OriginDomain,
    });
  }
}
