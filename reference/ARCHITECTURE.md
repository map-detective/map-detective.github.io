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
| テスト | Jest + @vue/test-utils（単体）、Firebase Emulator（セキュリティルール） |

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
│   ├── room.js          ルーム ID の生成・検証と RTDB 参照の組み立て
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

`with-friends` の `beforeEnter` は `isValidRoomId`（`^[A-Za-z0-9_-]{20,64}$`）で ID を検査し、
外れていればトップへ戻す。セキュリティルールも同じ条件で弾くが、そちらは無言で失敗するため、
画面に入る前に処理する。

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
3. ルーム ID は利用者に入力させず、`generateRoomId()` が 22 文字で発行する
   （`src/utils/room.js`）。招待リンクの ID を推測されるとルームを覗かれるため、
   `Math.random` ではなく `crypto.getRandomValues` を使う
4. `searchRoom` → `SETTINGS_SET_ROOM` が `roomRef()` で `rooms/<ルーム ID>` を参照し、
   `playersCounter` をトランザクションで採番して自分のプレイヤー番号を得る
5. プレイヤー番号が 1 なら `createdAt` を書き込み、マップ選択・ゲーム設定へ進む
6. 名前入力画面で招待 URL（`/room/<ルーム ID>`）を共有する
7. 参加者が 2 人以上そろうと「次へ」が押せるようになり、ゲームが始まる

### 参加者（2人目以降）

1. 招待リンク `/room/<ルーム ID>` を開く
2. `CardRoomName` はルートパラメータから ID を拾い、ログインを求めずに `searchRoom` を実行する
3. 採番されたプレイヤー番号が 2 以上なので、名前入力画面へ直行する
4. ホストが開始すると、`size` と `streetView` の出現を監視している `searchRoom` の
   リスナーが `startGame` を呼び、ゲーム画面へ遷移する

### プレイヤー名の扱い

入力された名前は `setPlayerName` で正規化・検証してから RTDB に書き込む。

- NFKC 正規化して前後の空白を落とす（全角英数を半角へそろえる）
- 使える文字は英数字・ひらがな・カタカナ・漢字・`_`・`-`
- 長さは 1〜20 文字。セキュリティルール側は 30 文字までを許すため、先に画面で弾く
- 同じルームに同名の人がいる場合は無効とする

検証を通らなかった場合は RTDB へ書き込まず、入力欄にエラーを出すだけにとどめる。
入室時に名前が未入力なら、`player<N>` を含む仮名を先に書き込んでおく。

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
- 読み書きできるのは `rooms/$room` 配下だけ
- ルーム（`rooms/$room`）は ID を知っていれば誰でも読める。書き込みは
  **既存ルームなら誰でも**、**新規作成は許可アカウントのみ**（`data.exists() || (許可条件)`）
- ルーム ID は `^[a-zA-Z0-9_-]{20,64}$` に限定。`src/utils/room.js` の
  `ROOM_ID_PATTERN` と同じ条件を保つこと
- 全フィールドに `.validate` を書いてスキーマを固定している。`playerName/$player` は
  30 文字以内の文字列、`playersCounter` と `size` は 1〜100、`nbRoundSelected` と
  `trigger` は 1〜99 の数値
- 未知のフィールドは拒否される。アプリに値を足すときはルールの更新が必要

## Realtime Database のデータ構造

ルームは `rooms/` 配下に、ルーム ID をキーとして作られる。ルート直下に置くと、
セキュリティルールでルームと他のデータを区別できずスキーマを固定できないため、
`rooms/` にまとめている。パスの組み立ては `src/utils/room.js` の `roomRef()` に集約する。

```
rooms/
└── <roomId>/
    ├── createdAt          作成時刻（ServerValue.TIMESTAMP）。未使用ルームの掃除に使う
    ├── playersCounter     プレイヤー番号の採番カウンタ
    ├── playerName/
    │   └── player<N>      各プレイヤーの表示名
    ├── started            ゲーム開始済みフラグ（途中参加を止める）
    ├── active             ゲーム進行中フラグ。消えると全員が強制退出する
    ├── size               参加人数
    ├── （ゲーム設定）      modeSelected / time / timeLimitation / difficulty / bboxObj /
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

1 ラウンドの制限時間は `time` と `timeLimitation` の両方に同じ値が入る。ゲーム画面が
読むのは `timeLimitation` で、`time` は設定オブジェクトをそのまま書き込んだ結果として残る。

出題地点を決めるのはホスト（プレイヤー番号 1）だけで、他のプレイヤーは
`streetView/round<N>` を読んで同じ場所を表示する。

放置されたルームは GitHub Actions（`clean-rooms.yml` → `scripts/clean-rooms.js`）が
定期的に削除する。`createdAt` から 1 日以上経過したもの、および `createdAt` を持たない
ものが対象。

## ゲームの進行

1. ゲーム画面に入った各自が `active` を立てる。以降、`active` が消えたルームからは
   全員が強制退出する（リロードやブラウザの戻る操作でも消える）
2. ホストが `StreetViewService` で出題地点を決め、`streetView/round<N>` に書き込む
3. 全員が `round<N>` に自分のノードを作ると（`round<N>` の子要素数 === `size`）ラウンド開始
4. 各自が地図をクリックして回答し、`guess/player<N>` と `round<N>/player<N>` を書き込む
5. 全員の回答がそろうと結果を表示し、`trigger` を合図に次のラウンドへ進む
6. 規定ラウンド数（既定 5、タイムアタック時は 10）を終えると `isGameDone` を立てる
7. 全員分の `isGameDone` がそろうと `active` を消し、ルームを削除する

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
| `npm run test` | `lint` + `test:unit` |
| `npm run test:rules` | Realtime Database のセキュリティルールのテスト（Java 21 以上が必要。任意） |
| `npm run test:mutation` | Stryker によるミューテーションテスト |

### CI（`ci.yml`）

`main` への push、プルリクエスト、マージキューで起動し、lint → 単体テスト →
カバレッジ送信 → ビルドの順に実行する。API キーの実値は不要なため、
環境変数にはダミー値を入れている。

`test:rules` は CI に含めていない。Emulator と Java が必要で、ルールを変更したときだけ
手元で実行すればよいためである。詳細は [DATABASE_RULES_TEST.md](DATABASE_RULES_TEST.md) を参照。

ミューテーションテスト（`ci-mutation-testing.yml`）は毎週日曜に別枠で走る。

静的解析は CodeQL（`codeql-analysis.yml`）が担う。`main` への push とプルリクエスト、
および毎週土曜の定期実行で JavaScript を解析し、結果はリポジトリの
Security > Code scanning alerts に出る。

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

### Docker イメージ（`publish-image.yml`）

`v*` タグの push と手動実行で、`ghcr.io/<リポジトリ>` へイメージを公開する
（`linux/amd64` と `linux/arm64`）。セルフホストしたい人向けの配布物で、
GitHub Pages / Firebase Hosting での運用には使わない。

`VUE_APP_*` はビルド時にプレースホルダを埋め込んでおき、コンテナ起動時に
`entrypoint.sh` が実際の環境変数へ置き換える。API キーをイメージに焼き込まないための作り。

## コーディング規約

- Prettier（インデント 4、シングルクォート、セミコロンあり、`trailingComma: es5`）
- ESLint（`plugin:vue/essential`）。本番ビルド時は `no-console` と `no-debugger` がエラー
- Vue テンプレートのインデントは 4 スペース（`vue/html-indent`）
- コメントには変更の経緯ではなく、現在の仕様と「なぜそうしているか」を書く
