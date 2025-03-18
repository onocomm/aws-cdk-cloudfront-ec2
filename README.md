# AWS CDK CloudFront + EC2 + WAF プロジェクト

このプロジェクトでは、AWS CDKを使用して以下のインフラストラクチャを構築します：
1. 既存のEC2インスタンスをオリジンとするCloudFrontディストリビューション
2. CloudFrontディストリビューションに接続されたWAFによるセキュリティ強化

## 構成内容

このスタック（`CdkCloudFrontEc2Stack`）は次のリソースを作成します：

1. **WAF Web ACL**:
   - レートベース制限：IPアドレスごとに100リクエスト/5分に制限（DDoS対策）
   - SQLインジェクション対策：AWSマネージドルールセット
   - 一般的なWebアプリケーション脆弱性対策：AWSマネージドルールセット

2. **CloudFrontディストリビューション**:
   - 既存のEC2インスタンスをオリジンとして使用
   - ビューワーからのHTTPリクエストをHTTPSにリダイレクト
   - 最適化されたキャッシュポリシー
   - WAF Web ACLによる保護

## デプロイ前の準備

1. `bin/cdk-cloudfront-ec2.ts` ファイルを編集し、以下の設定を変更：
   - `EC2InstanceId` の値を実際のEC2インスタンスIDに変更（デフォルト: `i-xxxxxxxxxxxxxxxxx`）

## デプロイ方法

```bash
npm run build   # TypeScriptをJavaScriptにコンパイル
cdk deploy      # AWSアカウントにスタックをデプロイ
```

デプロイ後は、出力される以下の情報を使用してCloudFrontディストリビューションにアクセスできます：
- `DistributionDomainName`: CloudFrontディストリビューションのドメイン名
- `WebACLId`: WAF Web ACLのID
- `EC2InstanceId`: 関連付けられたEC2インスタンスID

## 注意事項

- EC2インスタンスにはパブリックにアクセス可能なDNS名またはIPアドレスが必要です。
- EC2インスタンスのセキュリティグループで、CloudFrontからのインバウンドHTTPトラフィック（ポート80）を許可していることを確認してください。

## その他のコマンド

* `npm run watch`   変更を監視して自動コンパイル
* `npm run test`    Jestを使用したユニットテストの実行
* `cdk diff`        デプロイ済みスタックと現在の状態を比較
* `cdk synth`       CloudFormationテンプレートを出力
