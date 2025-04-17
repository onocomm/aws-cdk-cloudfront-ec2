# AWS CDK CloudFront + EC2 プロジェクト

このプロジェクトでは、AWS CDKを使用して以下のインフラストラクチャを構築します：

- 既存のEC2インスタンスをオリジンとするCloudFrontディストリビューション
- アクセスログ記録用のS3バケット
- カスタムキャッシュポリシー

## 構成内容

このスタック（`CdkCloudFrontEc2Stack`）は次のリソースを作成します：

1. **S3バケット**:
   - CloudFrontアクセスログを保存するためのバケット

2. **CloudFrontディストリビューション**:
   - 既存のEC2インスタンスをオリジンとして使用
   - ビューワーからのHTTPリクエストをHTTPSにリダイレクト
   - カスタムキャッシュポリシー
   - 画像パス（/images/*）に対する特別なビヘイビア設定
   - Origin Shieldの有効化

3. **キャッシュポリシー**:
   - デフォルトTTL: 5分
   - 最小TTL: 1秒
   - 最大TTL: 365日
   - クエリストリングによるキャッシュキー変更
   - BrotliとGzip圧縮の有効化

## デプロイ前の準備

1. `lib/cdk-cloudfront-ec2-stack.ts` ファイルを編集し、以下の設定を変更：
   - `OriginDomain` の値を実際のEC2インスタンスのドメイン名に変更（例: `ec2-xxx-xxx-xxx-xxx.ap-northeast-1.compute.amazonaws.com`）
   - `Region` の値を実際のリージョンに変更（デフォルト: `ap-northeast-1`）
   - `LogBucket` の値をユニークなS3バケット名に変更

2. 必要に応じて、以下の設定も変更できます：
   - カスタムドメイン名とACM証明書の設定（現在はコメントアウト）
   - キャッシュポリシーの詳細設定
   - 追加ビヘイビアの設定

## リージョン設定

注意：bin/cdk-cloudfront-ec2.tsファイルではリージョンが`us-east-1`に設定されていますが、CloudFrontディストリビューションはグローバルリソースなのでこの設定で問題ありません。ただし、Origin Shieldリージョンは`ap-northeast-1`に設定されているため、EC2インスタンスもこのリージョンに作成されている必要があります。

## デプロイ方法

```bash
npm run build   # TypeScriptをJavaScriptにコンパイル
cdk deploy      # AWSアカウントにスタックをデプロイ
```

デプロイ後は、出力される以下の情報を使用してCloudFrontディストリビューションにアクセスできます：
- `DistributionId`: CloudFrontディストリビューションのID

## 注意事項

- EC2インスタンスにはパブリックにアクセス可能なドメイン名が必要です。
- EC2インスタンスのセキュリティグループで、CloudFrontからのインバウンドHTTPトラフィック（ポート80）を許可していることを確認してください。
- このプロジェクトでは現在WAF統合は実装されていません。セキュリティを強化するには、WAF Web ACLを別途設定し、CloudFrontディストリビューションに関連付けることを検討してください。

## その他のコマンド

* `npm run watch`   変更を監視して自動コンパイル
* `npm run test`    Jestを使用したユニットテストの実行
* `cdk diff`        デプロイ済みスタックと現在の状態を比較
* `cdk synth`       CloudFormationテンプレートを出力
