# 開発の手引き

map-detective は [GeoGuess](https://github.com/GeoGuess/GeoGuess) をフォークし、
広告を除去してマルチプレイ専用に作り替えた、個人用途・セルフホスト向けのプロジェクトです。

設計や実装の方針は [設計・実装メモ](reference/ARCHITECTURE.md) にまとめています。

## 開発環境の準備

Node.js は `.nvmrc` のバージョン（20.14）を使います。

Google Maps Platform と Firebase の設定が必要です。手順は次のドキュメントを参照してください。

- [Google Maps API 設定手順](reference/GOOGLE_MAPS_SETUP.md)
- [Firebase セットアップ手順](reference/FIREBASE_SETUP.md)

キーを取得したら、`.env.dist` をコピーして `.env` を作り、値を設定します。

```bash
cp .env.dist .env
npm install
npm run serve
```

`.env` の値はビルド結果に埋め込まれ、公開されます。秘匿すべき値は置かないでください。

## コマンド

```bash
npm run serve      # 開発サーバー
npm run build      # 本番ビルド
npm run lint       # ESLint + Prettier
npm run test:unit  # 単体テスト
npm run test       # lint + 単体テスト
npm run test:rules # セキュリティルールのテスト（任意。Java 21 以上が必要）
```

`main` への push とプルリクエストでは、GitHub Actions が `lint` → 単体テスト → ビルドを実行します。

## コーディング規約

- Prettier（インデント 4、シングルクォート、セミコロンあり、`trailingComma: es5`）
- ESLint（`plugin:vue/essential`）。本番ビルドでは `no-console` と `no-debugger` がエラーになります
- コメントには変更の経緯ではなく、現在の仕様と「なぜそうしているか」を書きます

## Realtime Database のルールを変更するとき

セキュリティルールは全フィールドに検証を書いてスキーマを固定しているため、
アプリに値を1つ足すだけでもルールの更新が必要です。更新漏れは本番の書き込みが
無言で拒否される形で表面化するため、変更したら必ず `npm run test:rules` を実行してください。

詳細は [セキュリティルールのテスト](reference/DATABASE_RULES_TEST.md) を参照してください。

ルールとアプリは同時にデプロイしてください。ルールだけ先に反映すると、
古いコードからの書き込みがすべて拒否されます。

## プルリクエスト

1. `npm run test` が通ることを確認する
2. 何をしたかを説明する（書式の決まりはありません）

## 翻訳を追加するとき

1. `src/lang/locale/` に `en.json` と同じ構造のファイルを追加する
2. `src/plugins/vuetify.js` の `locales` に、Vuetify の言語定義を追加する

```js
import ru from 'vuetify/es5/locale/ru';

export default new Vuetify({
    lang: {
        locales: { en, fr, ja, cs, de, ru /* ... */ },
    },
});
```

`ja` と `en` 以外で訳が欠けている項目は、`en` にフォールバックします。
