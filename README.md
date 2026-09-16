# map-detective

**map-detective** は、オープンソースの地理推測ゲーム [GeoGuess](https://github.com/GeoGuess/GeoGuess) をベースに、自分専用にカスタマイズしたプロジェクトです。広告を完全に除去し、Google Maps API キーを使ってセルフホストでプレイできます。

## 🔄 このリポジトリの変更点

- Google AdSense やその他の広告コンポーネントをすべて削除
- 自分専用の UI 日本語翻訳を追加
- Firebase Realtime Database によるマルチプレイ機能対応
- 遊び方をマルチプレイ専用に変更（ソロプレイは廃止）
- ルーム作成を、許可した Google アカウントに限定
- Realtime Database のセキュリティルールでアクセス制御（ルート非公開・スキーマ固定）
- 招待 URL のルーム ID を、推測されにくい 22 文字の乱数に変更
- Firebase Hosting / GitHub Pages でのデプロイ手順を明文化

## 🕹️ 遊び方

1. ルームを作る人（ホスト）が、許可された Google アカウントでログインします
2. マップとゲーム設定を選ぶと、招待 URL が発行されます
3. 招待 URL を共有します。**参加する側にログインは必要ありません**
4. 2 人以上そろったらホストがゲームを開始します
5. ランダムに表示される Google ストリートビューの風景を見て、地図上で場所を推測します。正解に近いほどスコアが高くなります

ラウンド数は既定で 5 回（タイムアタック時は 10 回）です。

## 🚀 セットアップ方法（ローカル）

```bash
git clone https://github.com/map-detective/map-detective.github.io.git
cd map-detective
npm install
npm run serve
```

`.env.dist` をコピーして `.env` を作成し、値を設定してください。

```bash
cp .env.dist .env
```

最低限、以下が必要です。

```env
VUE_APP_API_KEY=あなたのGoogleMapsAPIキー
VUE_APP_FIREBASE_API_KEY=FirebaseのAPIキー
VUE_APP_FIREBASE_PROJECT_ID=Firebaseのプロジェクト ID
VUE_APP_FIREBASE_DATABASE_URL=Realtime DatabaseのURL
VUE_APP_ALLOWED_ACCOUNTS=@example.com
```

`VUE_APP_ALLOWED_ACCOUNTS` には、ルームを作成できる Google アカウントをカンマ区切りで指定します（`@example.com` でドメイン全体、`alice@gmail.com` で個別のアドレス）。変数の一覧は [設計・実装メモ](reference/ARCHITECTURE.md#環境変数) を参照してください。

## 🔧 セットアップ・設定ドキュメント

- [Firebase セットアップ手順](reference/FIREBASE_SETUP.md)
- [Google Maps API 設定手順](reference/GOOGLE_MAPS_SETUP.md)
- [GitHub Pages での設定手順](reference/GITHUB_SETUP.md)
- [マップ一覧 JSON の書式](reference/MapsJson.md)
- [設計・実装メモ](reference/ARCHITECTURE.md)
- [セキュリティルールのテスト](reference/DATABASE_RULES_TEST.md)

## 🛠 技術構成

- フロントエンド：Vue 2 + Vuetify 2 + Vuex
- 地図 API：Google Maps JavaScript API + ストリートビュー
- マルチプレイ：Firebase Realtime Database
- 認証：Firebase Authentication（Google ログイン、ルーム作成者のみ）
- PWA 対応（モバイルでも快適に動作）
- デプロイ：GitHub Pages または Firebase Hosting

## 🧪 開発コマンド

```bash
npm run serve      # 開発サーバー
npm run build      # 本番ビルド
npm run lint       # ESLint + Prettier
npm run test:unit  # 単体テスト
npm run test:rules # セキュリティルールのテスト（任意。Java 21 以上が必要）
```

`main` への push とプルリクエストでは、GitHub Actions（CI）が lint・単体テスト・ビルドを実行します。

`npm run test:rules` は Firebase Emulator を使うため Java 21 以上を必要としますが、**実行しなくても開発・ビルド・デプロイには影響しません**。CI にも含めていません。`database.rules.template.json` を変更するときだけ実行してください。詳細は [セキュリティルールのテスト](reference/DATABASE_RULES_TEST.md) を参照してください。

## 📄 ライセンス

このプロジェクトは [MIT License](LICENSE) のもとで公開されています。
元プロジェクト [GeoGuess](https://github.com/GeoGuess/GeoGuess) も MIT ライセンスを採用しています。

## ✍️ 作者

- Kenichi Wakabayashi
- 本プロジェクトは個人用途およびセルフホスト用に公開しています。
konk