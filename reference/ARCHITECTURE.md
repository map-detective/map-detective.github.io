# map-detective 設計・実装メモ

現在の構成と実装をまとめたドキュメント。セットアップ手順は
[FIREBASE_SETUP.md](FIREBASE_SETUP.md) / [GOOGLE_MAPS_SETUP.md](GOOGLE_MAPS_SETUP.md) /
[GITHUB_SETUP.md](GITHUB_SETUP.md) を参照。

## 全体像

[GeoGuess](https://github.com/GeoGuess/GeoGuess) をフォークし、次の方針で作り替えたもの。

- **マルチプレイ専用**。ソロプレイのメニューは持たない
- **ルームを作れるのは許可された Google アカウントだけ**。参加者はログイン不要
- サーバーを持たず、ブラウザから Google Maps API と Firebase Realtime Database を直接叩く

### 技術スタック

| 領域 | 採用しているもの |
|---|---|
| フレームワーク | Vue 2.7 + Vue CLI 5（`vue-cli-service`） |
| UI | Vuetify 2 |
| 状態管理 | Vuex 3 |
| ルーティング | Vue Router 3（history モード） |
| 地図・ストリートビュー | Google Maps JavaScript API（`gmap-vue`）、`v: 'weekly'`、非同期読み込み |
| リアルタイム同期 | Firebase Realtime Database（SDK は v8 系の名前空間 API） |
| 認証 | Firebase Authentication（Google プロバイダ、ポップアップ方式） |
| 地理計算 | `@turf/*`、`random-position-in-polygon` |
| ローカル保存 | IndexedDB（自作マップ）、localStorage（言語設定） |
| 多言語 | vue-i18n（17 言語。ja / en 以外は en へフォールバック） |
| テスト | Jest + @vue/test-utils（単体）、Cypress（E2E） |

## ディレクトリ構成

```
src/
├── main.js              アプリ初期化。Firebase / gmap-vue / i18n の設定
├── router.js            ルート定義
├── constants.js         ゲームモード・スコアモード等の定数
├── pages/               画面単位のコンポーネント
│   ├── Home.vue         トップ画面
│   ├── StreetView.vue   ゲーム本体（ラウンド進行と RTDB 同期）
│   ├── HistoryPage.vue  プレイ履歴
│   └── MedalsPage.vue   メダル一覧
├── components/
│   ├── dialogroom/      ルーム作成・参加のダイアログ（ステップ形式）
│   ├── game/            ゲーム中のリーダーボード・結果マップ
│   ├── history/         履歴テーブル
│   ├── home/            トップ画面のマップ選択・カスタムマップ作成
│   ├── map/             地図表示の共通コンポーネント
│   ├── page/            ヘッダー・フッター等の共通レイアウト
│   └── shared/          汎用パーツ
├── store/
│   ├── index.js         modules/ 配下を自動登録（`<名前>Store` として参照）
│   ├── mutation-types.js
│   └── modules/         home / settings / area / alert
├── plugins/             StreetViewService、IndexedDBService、axios、vuetify
├── utils/
│   ├── index.js         GeoJSON 検証・座標計算などの共通処理
│   ├── allowedAccounts.js  ルーム作成を許可するアカウントの判定
│   └── game/            スコア計算・メダル判定
├── models/GeoMap.js     マップ（公式・カスタム）のモデル
└── lang/                i18n 設定と言語ファイル
```

## 画面とルート

| パス | 名前 | 内容 |
|---|---|---|
| `/`（`/index.html`） | `home` | トップ画面。マップを選んでルームを作る |
| `/custom` | `home custom` | トップ画面をカスタムマップ作成ダイアログ付きで開く |
| `/room/:roomName` | `Room` | 招待リンク。トップ画面を開き、そのルームへ自動参加する |
| `/history` | `History` | ローカルに保存したプレイ履歴 |
| `/medals` | `Medals` | 訪問した国とメダルの一覧 |
| `/street-view/with-friends/:roomName` | `with-friends` | ゲーム画面 |
| 上記以外 | — | `/` へリダイレクト |

`with-friends` の `beforeEnter` で、ルーム ID に Firebase の禁止文字（`.` `#` `$` `[` `]`）が
含まれる場合はトップへ戻す。

## ルーム作成・参加のフロー

ダイアログは `DialogRoom.vue` が `currentComponent` の値でステップを切り替える方式。

```
roomName → settingsMap → settings → playerName → ゲーム開始
(CardRoomName) (CardRoomMap) (CardRoomSettings) (CardRoomPlayerName)
```

### ホスト（1人目）

1. トップ画面の「友達と遊ぶ」でダイアログを開く
2. `CardRoomName` が `getCurrentHost` で認証状態を確認する
   - ログイン済みかつ許可アカウント → そのまま次へ
   - 未ログイン → ログインボタンを表示する。ポップアップのブロックを避けるため、
     サインインは必ず利用者の操作を起点にする
3. ルーム名は利用者に入力させず、10 文字の擬似乱数で発行する
4. `searchRoom` → `SETTINGS_SET_ROOM` で RTDB のルームを参照し、
   `playersCounter` をトランザクションで採番して自分のプレイヤー番号を得る
5. プレイヤー番号が 1 なら `createdAt` を書き込み、マップ選択・ゲーム設定へ進む
6. 名前入力画面で招待 URL（`/room/<ルーム名>`）を共有する
7. 参加者が 2 人以上そろうと「次へ」が押せるようになり、ゲームが始まる

### 参加者（2人目以降）

1. 招待リンク `/room/<ルーム名>` を開く
2. `CardRoomName` はルートパラメータから ID を拾い、ログインを求めずに `searchRoom` を実行する
3. 採番されたプレイヤー番号が 2 以上なので、名前入力画面へ直行する
4. ホストが開始すると、`size` と `streetView` の出現を監視している `searchRoom` の
   リスナーが `startGame` を呼び、ゲーム画面へ遷移する

### 状態管理上の注意点

- `joining` / `joined` / `roomListenerAttached` の 3 つのフラグで、多重入室と
  リスナーの二重登録を防いでいる
- 自分のプレイヤー名ノードには `onDisconnect().remove()` を仕掛けてあり、
  切断時に自動で消える
- ダイアログを閉じたとき、1 人目ならルームごと削除、2 人目以降は自分のノードだけ削除する
- 読み取り・監視が拒否された場合のエラーコールバックを必ず用意する。
  これが無いと成功時の処理が呼ばれず、待機状態のまま固まる

## アクセス制御

ルーム作成の可否は **二段構え**で判定する。

| 層 | 実装 | 役割 |
|---|---|---|
| クライアント | `src/utils/allowedAccounts.js` | 許可されていない理由をその場で伝える |
| サーバー | Realtime Database セキュリティルール | 実際のアクセス制御 |

クライアント側の判定はあくまで案内用で、`VUE_APP_ALLOWED_ACCOUNTS` が未設定のビルドでは
スキップされる。実効的な防御はセキュリティルールが担う。

### 許可アカウントの書式

`VUE_APP_ALLOWED_ACCOUNTS`（アプリ側）と `FIREBASE_ALLOWED_DOMAIN`（ルール生成側）は
同じ書式で、同じ値を設定する。カンマ区切りで複数指定できる。

- `@example.com` … そのドメインのアカウントをすべて許可
- `alice@gmail.com` … そのアドレスのみ許可

Google のログイン画面に許可ドメインを表示させたくないため、`hd`（ホストドメイン）
パラメータは指定せず、ログイン後にアプリ側で判定している。許可されないアカウントで
ログインした場合はサインアウトさせ、`app/account-not-allowed` を投げる。

### セキュリティルールの生成

ルールは Secret の値を埋め込んで組み立てるため、リポジトリにはテンプレートだけを置く。

```
database.rules.template.json  ← __HOST_CONDITION__ を含むテンプレート（コミットする）
        ↓  scripts/build-database-rules.js（FIREBASE_ALLOWED_DOMAIN を読む）
database.rules.json           ← 生成物（.gitignore 対象）
```

生成される条件式は次の 4 つをすべて満たすことを要求する。

1. `auth != null`
2. `auth.token.firebase.sign_in_provider == 'google.com'`
3. `auth.token.email_verified == true`
4. 許可アカウントのいずれかに一致

ルール式へ値を埋め込むため、生成スクリプトはドメイン／メールアドレスの形式を検証し、
不正なら生成を中止する。`FIREBASE_ALLOWED_DOMAIN` が未設定の場合も、誰でもルームを
作れるルールができてしまわないよう中止する。

### ルールの要点

- ルート直下は読み書き禁止
- ルーム（`$room`）は誰でも読める。書き込みは **既存ルームなら誰でも**、
  **新規作成は許可アカウントのみ**（`data.exists() || (許可条件)`）
- ルーム名は `^[a-zA-Z0-9_-]{4,64}$` に限定
- `playerName/$player` は 30 文字以内の文字列、`playersCounter` と `size` は 1〜100 の数値

## Realtime Database のデータ構造

ルームは DB のルート直下に、ルーム名をキーとして作られる。

```
<roomName>/
├── createdAt          作成時刻（ServerValue.TIMESTAMP）。未使用ルームの掃除に使う
├── playersCounter     プレイヤー番号の採番カウンタ
├── playerName/
│   └── player<N>      各プレイヤーの表示名
├── started            ゲーム開始済みフラグ（途中参加を止める）
├── active             ゲーム進行中フラグ。消えると全員が強制退出する
├── size               参加人数
├── （ゲーム設定）      modeSelected / timeLimitation / difficulty / bboxObj /
│                      countdown / scoreMode / areaParams / nbRoundSelected /
│                      allPanorama / optimiseStreetView / zoomControl /
│                      moveControl / panControl / timeAttackSelected /
│                      scoreLeaderboard / guessedLeaderboard
├── streetView/
│   └── round<N>       出題地点（latitude / longitude / roundInfo / area / warning）
├── round<N>/
│   └── player<N>      回答結果（座標または地域コード / distance / points / timePassed）
├── guess/
│   └── player<N>      そのラウンドで回答済みかどうか
├── finalScore/player<N>   累計距離
├── finalPoints/player<N>  累計スコア
├── trigger/player<N>      次ラウンドへ進む合図
└── isGameDone/player<N>   ゲーム終了フラグ。全員分そろうとルームが削除される
```

出題地点を決めるのはホスト（プレイヤー番号 1）だけで、他のプレイヤーは
`streetView/round<N>` を読んで同じ場所を表示する。

放置されたルームは GitHub Actions（`clean-rooms.yml` → `scripts/clean-rooms.js`）が
定期的に削除する。`createdAt` から 1 日以上経過したもの、および `createdAt` を持たない
ものが対象。

## ゲームの進行

1. ホストが `StreetViewService` で出題地点を決め、`streetView/round<N>` に書き込む
2. 全員が `round<N>` に自分のノードを作ると（`round<N>` の子要素数 === `size`）ラウンド開始
3. 各自が地図をクリックして回答し、`guess/player<N>` と `round<N>/player<N>` を書き込む
4. 全員の回答がそろうと結果を表示し、`trigger` を合図に次のラウンドへ進む
5. 規定ラウンド数（既定 5、タイムアタック時は 10）を終えると `isGameDone` を立てる
6. 全員分の `isGameDone` がそろうとルームを削除する

スコアは `src/utils/game/score.js` で距離と難易度から算出する。難易度はマップの
バウンディングボックスの最大距離の 1/10（マップ未指定なら 2000）。

プレイ履歴は RTDB ではなく、各自のブラウザの IndexedDB に保存する。

## 環境変数

`.env`（ローカル）または GitHub Secrets（CI）で設定する。すべて `VUE_APP_` 接頭辞が
必要で、ビルド時にバンドルへ埋め込まれる。

| 変数 | 用途 |
|---|---|
| `VUE_APP_API_KEY` | Google Maps JavaScript API のキー |
| `VUE_APP_FIREBASE_API_KEY` | Firebase の API キー |
| `VUE_APP_FIREBASE_AUTH_DOMAIN` | 認証ドメイン（未指定なら `<projectId>.firebaseapp.com`） |
| `VUE_APP_FIREBASE_DATABASE_URL` | RTDB の URL（未指定なら `<projectId>.firebaseio.com`） |
| `VUE_APP_FIREBASE_PROJECT_ID` | Firebase プロジェクト ID |
| `VUE_APP_STORAGE_BUCKET` | Storage バケット（未指定なら `<projectId>.appspot.com`） |
| `VUE_APP_FIREBASE_MESSAGING_SENDER_ID` | 送信者 ID |
| `VUE_APP_FIREBASE_APP_ID` | アプリ ID |
| `VUE_APP_FIREBASE_MEASUREMENT_ID` | Analytics の測定 ID。設定した場合のみ Analytics を有効化する |
| `VUE_APP_ALLOWED_ACCOUNTS` | ルーム作成を許可するアカウント（`FIREBASE_ALLOWED_DOMAIN` と同じ値） |
| `VUE_APP_LIST_MAPS_JSON_URL` | 選択できるマップ一覧の JSON。書式は [MapsJson.md](MapsJson.md) |
| `VUE_APP_PUBLIC_PATH` | サブパス配信時のベースパス（本番ビルドのみ有効） |

`.env` に書く値は公開されるバンドルに含まれる。秘匿すべき値は置かないこと。

## ビルドとデプロイ

| コマンド | 内容 |
|---|---|
| `npm run serve` | 開発サーバー（http://localhost:8080） |
| `npm run build` | 本番ビルド（`dist/`） |
| `npm run lint` | ESLint + Prettier |
| `npm run test:unit` | Jest による単体テスト |
| `npm run test:e2e` | Cypress による E2E テスト |

### GitHub Pages（`deploy-gh-pages.yml`）

`main` への push で起動する。Secrets から環境変数を渡してビルドし、
`actions/deploy-pages` で公開する。`VUE_APP_ALLOWED_ACCOUNTS` には
Secret `FIREBASE_ALLOWED_DOMAIN` の値をそのまま渡している。

SPA を GitHub Pages で動かすため、`public/404.html` でルーティングを補っている。

### セキュリティルール（`deploy-database-rules.yml`）

テンプレート・生成スクリプト・`firebase.json` のいずれかが変更されたときに起動し、
ルールを生成して `firebase deploy --only database` を実行する。サービスアカウントキーは
一時ファイルに書き出し、ジョブ終了時に必ず削除する。

### Firebase Hosting

`firebase.json` で `dist` を公開し、すべてのパスを `/index.html` に書き換える設定。
手元から `firebase deploy` で配信する場合に使う。

## コーディング規約

- Prettier（インデント 4、シングルクォート、セミコロンあり、`trailingComma: es5`）
- ESLint（`plugin:vue/essential`）。本番ビルド時は `no-console` と `no-debugger` がエラー
- Vue テンプレートのインデントは 4 スペース（`vue/html-indent`）
- コメントには変更の経緯ではなく、現在の仕様と「なぜそうしているか」を書く
