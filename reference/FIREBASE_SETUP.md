# Firebase Setup for map-detective

このドキュメントは、GeoGuess クローン「map-detective」に Firebase を導入してマルチプレイ機能を有効化するためのセットアップ手順をまとめたものです。

## プラン選択
- **Sparkプラン（無料）** を選択してください。
  - ロケーション選択: `asia-southeast1`（シンガポール）
  - マルチプレイ目的であれば無料枠で十分運用可能です。

---

## Firebase プロジェクト作成手順

1. [Firebase Console](https://console.firebase.google.com/) にアクセスし、新しいプロジェクトを作成。
2. 「プロジェクト名」を入力し、Google Analytics は任意で設定。
3. プロジェクト作成後、下記を控える（`.env` に記載するため）:
    - `VUE_APP_FIREBASE_API_KEY`
    - `VUE_APP_FIREBASE_AUTH_DOMAIN`
    - `VUE_APP_FIREBASE_PROJECT_ID`
    - `VUE_APP_FIREBASE_DATABASE_URL`
    - `VUE_APP_STORAGE_BUCKET`
    - `VUE_APP_FIREBASE_MESSAGING_SENDER_ID`
    - `VUE_APP_FIREBASE_APP_ID`
    - `VUE_APP_FIREBASE_MEASUREMENT_ID`（Google Analytics を使用しないので空欄でOK）

* GitHub Pagesでホスティングする場合は、`.env`を利用しません。[GitHub Pages Setup for map-detective](GITHUB_SETUP.md)をご覧ください。

---

## Realtime Database の設定

1. 左メニュー「Build > Realtime Database」を選択。
2. 「データベースを作成」 > ロケーションを選択。
3. セキュリティルールは、作成時のテストモードのままにせず、下記「セキュリティルール」の手順で設定してください。

---

## Authentication の設定

ルームを作成できる人を、特定のドメインの Google アカウントに限定しています。そのための設定です。

1. 左メニュー「Build > Authentication」を選択し、「始める」を押す。
2. 「Sign-in method」タブで **Google** を有効にする。
3. 「Settings」タブ > 「承認済みドメイン」に、公開先のドメインを追加する。
    - GitHub Pages の場合: `map-detective.github.io`
    - Firebase Hosting の場合: `<project-id>.web.app`（既定で登録済み）
    - `localhost` は既定で登録されているため、ローカル開発では追加不要

招待リンクから参加する人にログインは不要です。ログインが必要なのはルームを作成するときだけです。

---

## セキュリティルール

ルートを閉じたうえで、ルーム単位でのみ読み書きを許可しています。

| 対象 | 権限 |
|:--|:--|
| データベース全体 | 読み書き禁止（ルームの一覧取得や一括削除を防ぐ） |
| 既存のルーム | ルーム ID を知っていれば読み書き可（参加者） |
| 新規ルームの作成 | 許可された Google アカウントのみ（ホスト） |

ルール本体は `database.rules.template.json` にあり、許可アカウントの部分だけを
プレースホルダ `__HOST_CONDITION__` にしています。実際の値は GitHub Secrets に登録し、
デプロイ時に `scripts/build-database-rules.js` が埋め込みます。

この仕組みにより、許可アカウントの情報がリポジトリに残りません。

### 許可アカウントの指定方法

GitHub Secrets の `FIREBASE_ALLOWED_DOMAIN` にカンマ区切りで指定します。

| 書き方 | 意味 |
|:--|:--|
| `@example.com` | そのドメインのアカウントをすべて許可 |
| `alice@gmail.com` | そのアドレスのみ許可 |

両方を混ぜることもできます（例: `@example.com,alice@gmail.com`）。

### デプロイ方法

`main` ブランチへの push で、`.github/workflows/deploy-database-rules.yml` が自動実行されます。
手動で実行する場合は、GitHub の Actions タブから「Deploy Database Rules」を選び、
「Run workflow」を押してください。

メンバーを追加・削除するときは、Secret の値を書き換えてから手動実行します。

### ルームの自動削除

遊び終わったルームは通常その場で削除されますが、途中で全員が離脱すると残ります。
`.github/workflows/clean-rooms.yml` が毎日 4 時（JST）に実行され、
作成から 1 日以上経過したルームを削除します。

---

## .env ファイルへの追加

プロジェクトルートに `.env` ファイルを作成し、以下を記載：

```env
VUE_APP_FIREBASE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VUE_APP_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VUE_APP_FIREBASE_PROJECT_ID=your-project-id
VUE_APP_FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
VUE_APP_STORAGE_BUCKET=your-project-id.appspot.com
VUE_APP_FIREBASE_MESSAGING_SENDER_ID=000000000000
VUE_APP_FIREBASE_APP_ID=1:000000000000:web:xxxxxxxxxxxxxxxx
VUE_APP_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX （Google Analytics を使用しないので空欄でOK）
```

---

## 4. Firebase Hosting 導入手順（Vue.js アプリの場合）

Firebase Hosting を使うことで、Vue.js アプリを簡単に Web に公開できます。
本プロジェクトでは任意の選択ですが、チームメンバーが共有しやすくなるため推奨します。

### 🔹 初期設定（初回のみ）

```bash
firebase init hosting
```

初期化中に表示される英語の質問と推奨回答：

- `What do you want to use as your public directory? (public)` → `dist`
- `Configure as a single-page app (rewrite all urls to /index.html)? (Y/n)` → `Y`
- `Set up automatic builds and deploys with GitHub? (Y/n)` → `n`

### 🔹 デプロイコマンド

```bash
npm run build
firebase deploy
```

デプロイ成功後、以下のURLでアクセスできます：

```
https://<project-id>.web.app
```

---

## 無料枠の注意点

- Sparkプランは以下のような上限があります：
  - 同時接続数: 100人
  - 書き込み: 1GB/月
  - データ転送: 10GB/月

### 超過時の動作
- Firebase の無料枠を超えると **エラー発生** や **書き込み不可** となることがあります。
- ビルド失敗や強制的なアップグレードはされませんが、制限にかかる前に通知が届きます。

---

## その他

- Firebase SDK は `src/main.js` にて初期化されます。
- `firebase.analytics()` は `measurementId` がある場合のみ有効。
