import { Stack, StackProps, CfnOutput, RemovalPolicy, Duration } from 'aws-cdk-lib';
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
  AlternateDomainNames: string[];
  CertificateArn: string;
  OriginDomain: string;
  SettingBehaviors: Record<string, any>[];
  WhiteListIpSetArn: string;
  ManagedRules: string[];
  LogEnabled: boolean;
  LogBucket: string;
  LogFilePrefix: string;
  Description: string;
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
      AlternateDomainNames,
      CertificateArn,
      OriginDomain,
      SettingBehaviors,
      WhiteListIpSetArn,
      ManagedRules,
      LogEnabled,
      LogBucket,
      LogFilePrefix,
      Description,
    } = props as CdkStackProps;

    // ✅ AWS マネージドルールの設定
    const rules = ManagedRules.map((ruleName, index) => ({
      name: ruleName,
      priority: index + 1,
      statement: {
        managedRuleGroupStatement: {
          name: ruleName,
          vendorName: 'AWS',
        },
      },
      overrideAction: { none: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${ruleName}-Metrics`,
        sampledRequestsEnabled: true,
      },
    }));

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
        ...(WhiteListIpSetArn
          ? [{
              name: 'WhiteList',
              priority: 0,
              action: { allow: {} },
              statement: {
                ipSetReferenceStatement: {
                  arn: WhiteListIpSetArn,
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
        ...rules,
      ],
    });

    // ✅ WAF ログ設定（CloudWatch Logs に出力）
    if(LogEnabled){
      new wafv2.CfnLoggingConfiguration(this, 'WafLoggingConfig', {
        logDestinationConfigs: [(new logs.LogGroup(this, 'WafLogGroup', {
          logGroupName: `aws-waf-logs-${ResourceName}`,
          removalPolicy: RemovalPolicy.RETAIN, // ログの保持設定（削除しない）
        })).logGroupArn], // ✅ CloudWatch Logs を設定
        resourceArn: webAcl.attrArn,
      });
    }
    
    // ✅ CloudFrontのカスタムキャッシュポリシーを作成
    const customCachePolicy = new cloudfront.CachePolicy(this, 'CustomCachePolicy', {
      cachePolicyName: `${ResourceName}CachePolicy`,
      defaultTtl: Duration.minutes(5),  // デフォルトTTL 5分
      minTtl: Duration.seconds(1),    // 最小TTL 1秒
      maxTtl: Duration.days(365),       // 最大TTL 365日
      cookieBehavior: cloudfront.CacheCookieBehavior.none(), // Cookieなし
      headerBehavior: cloudfront.CacheHeaderBehavior.none(), //ヘッダーなし
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(), // すべてのクエリストリングをキャッシュキーに含める
      enableAcceptEncodingBrotli: true, // Brotli圧縮を有効化
      enableAcceptEncodingGzip: true,   // Gzip圧縮を有効化
    });

    // ✅ ビヘイビアの設定
    const behaviors = Object.fromEntries(
      SettingBehaviors.map((item) => ([
        item.pathPattern,
        {
          origin: new origins.HttpOrigin(item.originDomain, { // item.originDomain を使用
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY, // HTTP経由でオリジンと通信
            originShieldEnabled: true,
            originShieldRegion: 'ap-northeast-1',
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // HTTPリクエストをHTTPSにリダイレクト
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL, // ✅ GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE を許可
          cachePolicy: customCachePolicy, // キャッシュポリシー
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022, // すべてのヘッダーをオリジンにリレー
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT, // ✅ CORS設定
        }
      ]))
    );
    
    // ✅ CloudFrontディストリビューションの作成
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.HttpOrigin(OriginDomain, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY, // HTTP経由でオリジンと通信
          originShieldEnabled: true,
          originShieldRegion: 'ap-northeast-1',
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // ビューワーからのHTTPリクエストをHTTPSにリダイレクト
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL, // ✅ GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE を許可
        cachePolicy: customCachePolicy, // キャッシュ最適化のためのポリシー
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022, // ビューワーからのすべてのヘッダーをオリジンにリレー
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT, // ✅ SimpleCORS を設定
      },
      ...(behaviors.length > 0 &&
        { additionalBehaviors: behaviors } ),
      // WAFをアタッチ
      webAclId: webAcl.attrArn,
      // 他の設定
      comment: Description,
      // 料金クラス（北米、欧州のみ）
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      // 有効
      enabled: true,
      // 代替ドメイン名（CNAME）を指定
      ...(AlternateDomainNames?.[0] &&
        { domainNames: AlternateDomainNames }),
      // ACM証明書を指定
      ...(CertificateArn &&
          { certificate: certificatemanager.Certificate.fromCertificateArn(this, 'Certificate', CertificateArn) } ),
      // ログ保存用のS3バケットを指定
      ...(LogEnabled &&
        { logBucket: s3.Bucket.fromBucketName(this, 'LogBucket', LogBucket), LogFilePrefix }),
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
