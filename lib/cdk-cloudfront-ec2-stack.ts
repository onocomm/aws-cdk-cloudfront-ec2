import { Stack, StackProps, CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
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
  LogBucket: string;
  LogFilePrefix: string;
  LogRemoval: boolean;
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
      LogBucket,
      LogFilePrefix,
      LogRemoval,
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
    const wafLogGroup = new logs.LogGroup(this, 'WafLogGroup', {
      logGroupName:  `aws-waf-logs-${ResourceName}`,
      retention: logs.RetentionDays.FIVE_YEARS,
      removalPolicy: LogRemoval ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });

    // ✅ WAF のロギング設定
    new wafv2.CfnLoggingConfiguration(this, 'WafLoggingConfig', {
      logDestinationConfigs: [wafLogGroup.logGroupArn], // ✅ CloudWatch Logs を設定
      resourceArn: webAcl.attrArn,
    });
    
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

    const origin = new origins.HttpOrigin(OriginDomain, { // item.originDomain を使用
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY, // HTTP経由でオリジンと通信
      originShieldEnabled: true,
      originShieldRegion: 'ap-northeast-1',
    });

    // ✅ ビヘイビアの設定
    const behaviors = Object.fromEntries(
      SettingBehaviors.map((item) => ([
        item.pathPattern,
        {
          origin,
          viewerProtocolPolicy: CertificateArn ? cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS : cloudfront.ViewerProtocolPolicy.ALLOW_ALL, // HTTPリクエストをHTTPSにリダイレクト
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL, // ✅ GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE を許可
          cachePolicy: item.pathPattern ? customCachePolicy : cloudfront.CachePolicy.CACHING_DISABLED, // キャッシュポリシー
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022, // すべてのヘッダーをオリジンにリレー
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT, // ✅ CORS設定
        }
      ]))
    );

    // ✅ S3 バケット名を定義
    const logBucket = new s3.Bucket(this, 'LogBucket', {
      bucketName: LogBucket,
      autoDeleteObjects: false,
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      removalPolicy: LogRemoval ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });

    // ✅ CloudFrontディストリビューションの作成
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: CertificateArn ? cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS : cloudfront.ViewerProtocolPolicy.ALLOW_ALL, // HTTPリクエストをHTTPSにリダイレクト
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL, // ✅ GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE を許可
        cachePolicy: customCachePolicy, // キャッシュ最適化のためのポリシー
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_AND_CLOUDFRONT_2022, // ビューワーからのすべてのヘッダーをオリジンにリレー
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT, // ✅ SimpleCORS を設定
      },
      ...(SettingBehaviors.length &&
        { additionalBehaviors: behaviors }),
      // WAFをアタッチ
      webAclId: webAcl.attrArn,
      // 他の設定
      comment: Description,
      // 料金クラス（北米、欧州のみ）
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      // 有効
      enabled: true,
      // 代替ドメイン名（CNAME）を指定
      ...((AlternateDomainNames?.[0] && CertificateArn) &&
        { domainNames: AlternateDomainNames }),
      // ACM証明書を指定
      ...(CertificateArn &&
          { certificate: certificatemanager.Certificate.fromCertificateArn(this, 'Certificate', CertificateArn) } ),
      // ログ保存用のS3バケットを指定
      logBucket,
      logFilePrefix: LogFilePrefix,
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
