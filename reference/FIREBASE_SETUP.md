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
3. プロジェクトの作成後「設定 > 全般 > マイアプリ」からウェブアプリを作成し登録（Firebase Hostingの設定は不要）
4. Firebase SDKの追加に表示される以下のコードの部分をコピーする（npm / scriptどっちでもOK）　　
```js
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCQdm5QKV0Fxxxxxxxxz4ifIGLdnpNkFmDI",
  authDomain: "map-detective-27xxx.firebaseapp.com",
  projectId: "map-detective-27xxx",
  storageBucket: "map-detective-27xxx.firebasestorage.app",
  messagingSenderId: "24134xxx5400",
  appId: "1:241341655400:web:3caxxx5c858d3ecb084edd"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
````
* GitHub Pagesでホスティングする場合は、`.env`を利用しません。[GitHub Pages Setup for map-detective](GITHUB_SETUP.md)をご覧ください。

---

## Realtime Database の設定

データベース本体の作成は Firebase Console での手動作業、セキュリティルールの反映は
GitHub Actions からの自動デプロイと、担当が分かれています。

1. 左メニュー「Build > Realtime Database」を選択。
2. 「データベースを作成」 > ロケーションを選択。
    - ロケーションは作成時にしか選べないため、慎重に選んでください（米国でいいと思いますが）。
3. セキュリティルールの選択画面では、ここでは「テストモード」を選んでおきます。

* 本番運用時のセキュリティルールは、GitHub Actions からデプロイします。テストモードのルールはここで上書きされます。

---

## Authentication の設定

ルームを作成できる人を、特定のドメインの Google アカウントに限定しています。そのための設定です。

1. 左メニュー「セキュリティ > Authentication」を選択し、「始める」を押す。
2. 「ログイン方法」タブで **Google** を有効にする。
3. 「設定」タブ > 「承認済みドメイン」に、公開先のドメインを追加する。
    - GitHub Pages の場合: `map-detective.github.io`
    - Firebase Hosting の場合: `<project-id>.web.app`（既定で登録済み）
    - `localhost` は既定で登録されているため追加不要

招待リンクから参加する人にログインは不要です。ログインが必要なのはルームを作成するときだけです。

---

## セキュリティルール

以下の設定は、GitHub Actions からデプロイしますので、マニュアル操作は不要です。

---

ルートを閉じたうえで、`rooms/` 配下のルーム単位でのみ読み書きを許可しています。

| 対象 | 権限 |
|:--|:--|
| データベース全体 | 読み書き禁止（ルームの一覧取得や一括削除を防ぐ） |
| `rooms/<ルーム ID>`（既存） | ルーム ID を知っていれば読み書き可（参加者） |
| `rooms/<ルーム ID>`（新規作成） | 許可された Google アカウントのみ（ホスト） |

ルーム ID は 22 文字の乱数で発行され、ルールも 20 文字以上のみを受け付けます。
一覧を取得する手段がないため、ID を知らない人はルームにたどり着けません。

ルーム内の各フィールドにも型や範囲の検証を書いており、想定外の値や未知のフィールドは
書き込めません。アプリ側に新しい値を追加したときは、ルールの更新も必要です。

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

### アプリ側にも同じ値を設定する

セキュリティルールだけで判定すると、許可されていないアカウントでも Google ログイン自体は
通ってしまい、ルーム作成の段階で初めて失敗します。理由をその場で伝えるため、
アプリのビルド時にも同じ値を `VUE_APP_ALLOWED_ACCOUNTS` として渡してください。

| 設定先 | キー | 用途 |
|:--|:--|:--|
| GitHub Secrets | `FIREBASE_ALLOWED_DOMAIN` | セキュリティルールの生成（実際のアクセス制御） |
| ビルド時の環境変数（`.env` など） | `VUE_APP_ALLOWED_ACCOUNTS` | ログイン直後の確認とエラー表示 |

書式は同じなので、両方に同じ値を設定します。許可アカウントでない場合はログイン状態を
その場で破棄し、「このアカウントではルームを作成できません」と表示します。

`VUE_APP_ALLOWED_ACCOUNTS` はビルド成果物に含まれるため、利用者からは読み取れます。
アクセス制御そのものはセキュリティルールが担うため問題ありませんが、
許可アカウントを秘密にしたい場合はこの設定を省略してください（確認は行われなくなります）。

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

プロジェクトルートに `.env` ファイルを作成し、`firebaseConfig`の内容を記載します。


const firebaseConfig = {
  apiKey: "AIzaSyCQdm5QKV0Fxxxxxxxxz4ifIGLdnpNkFmDI",
  authDomain: "map-detective-27xxx.firebaseapp.com",
  projectId: "map-detective-27xxx",
  storageBucket: "map-detective-27xxx.firebasestorage.app",
  messagingSenderId: "24134xxx5400",
  appId: "1:241341655400:web:3caxxx5c858d3ecb084edd"
};


```env
VUE_APP_FIREBASE_API_KEY=`apiKey`
VUE_APP_FIREBASE_AUTH_DOMAIN=`authDomain`
VUE_APP_FIREBASE_PROJECT_ID=`projectId`
VUE_APP_FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
VUE_APP_STORAGE_BUCKET=`storageBucket`
VUE_APP_FIREBASE_MESSAGING_SENDER_ID=`messagingSenderId`
VUE_APP_FIREBASE_APP_ID=`appId`
VUE_APP_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX （Google Analyticsのコード。使用しないのであれば空欄でOK）
```

Google Maps の API キー（`VUE_APP_API_KEY`）と、ルーム作成を許可するアカウント
（`VUE_APP_ALLOWED_ACCOUNTS`）も同じ `.env` に記載します。項目の一覧は `.env.dist` を
コピーして使ってください。

---

## Firebase Hosting 導入手順（任意）

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
