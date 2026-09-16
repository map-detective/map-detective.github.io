# Realtime Database セキュリティルールのテスト

Realtime Database のセキュリティルールを、Firebase Emulator 上で検証する仕組みです。

## このテストは必須ではありません

**`npm run test:rules` を実行しなくても、開発・ビルド・デプロイ・他のテストはすべて動きます。**
`npm run test`（`lint` + `test:unit`）にも含めていません。

実行が必要になるのは `database.rules.template.json` を変更するときだけです。ルールを触らない作業では、このドキュメントを読む必要はありません。

---

## なぜテストが必要か

セキュリティルールは、書き損ねた瞬間に本番の書き込みが拒否されます。しかも Realtime Database は**拒否を無言で返す**ため、画面には何も起きません。ビルドが通ることは何の保証にもなりません。

現在のルールは全フィールドに `.validate` を書いてスキーマを固定しているため、フィールドを1つ追加するだけでもルールの更新が必要です。更新漏れはテストでしか気づけません。

---

## 実行方法

```bash
npm run test:rules
```

初回は Java が必要です。入っていない場合は次のエラーで止まります。

```
[test-rules] Java が見つかりません。'brew install openjdk@21' を実行してください。
```

### Java のインストール（macOS）

```bash
brew install openjdk@21
```

Homebrew の openjdk は keg-only で PATH に入りませんが、`scripts/test-rules.sh` が
`openjdk` → `openjdk@21` → `openjdk@25` の順に探して PATH に足すため、`~/.zshrc` を変更する必要はありません。

**Java 21 以上が必要です。** firebase-tools 15 は 21 未満を拒否します。

### macOS 以外

`java` コマンドが PATH にあれば、そのまま動きます。

---

## 仕組み

| ファイル | 役割 |
|---|---|
| `scripts/test-rules.sh` | Java の PATH 解決 → ルール生成 → Emulator 起動 → Jest 実行 |
| `jest.rules.config.js` | ルールテスト専用の Jest 設定（node 環境・カバレッジ無効） |
| `tests/rules/helpers.js` | Emulator の REST API を叩くラッパと、認証トークンの生成 |
| `tests/rules/database.rules.test.js` | テスト本体 |

実行の流れは次のとおりです。

1. `FIREBASE_ALLOWED_DOMAIN='@example.com'` で `database.rules.json` を生成する
2. `firebase emulators:exec --only database` で Emulator を起動する
3. Jest がテストを実行し、終了後に Emulator が停止する

### 認証をどう再現しているか

`@firebase/rules-unit-testing` は使っていません。v2 以降は firebase v9 以上を peer に要求しますが、本体は **firebase 8.10.1** を使っているため共存できないためです。

代わりに Emulator の REST API を直接叩いています。Emulator は JWT の**署名を検証しない**ので、`tests/rules/helpers.js` が必要な claim を持つトークンを組み立てれば、`auth.token.email` や `firebase.sign_in_provider` を見る条件もそのまま検証できます。

用意してある立場は次の5つです。

| 定数 | 立場 |
|---|---|
| `HOST_USER` | 許可ドメインの Google アカウント。ルームを作成できる |
| `OUTSIDER_USER` | 許可されていないドメインのアカウント |
| `UNVERIFIED_USER` | 許可ドメインだがメール未確認 |
| `PASSWORD_USER` | 許可ドメインだが Google 以外でログイン |
| `ANONYMOUS` | 未ログイン。ゲームの参加者はこの立場 |

### 許可ドメインの固定値

テストでは許可ドメインを `@example.com` に固定しています。この値は2箇所に書かれているため、**変更するときは両方を揃えてください**。

- `scripts/test-rules.sh` の `FIREBASE_ALLOWED_DOMAIN`
- `tests/rules/helpers.js` の `ALLOWED_DOMAIN`

---

## テストの書き方

`read` / `write` / `update` / `remove` は、ルールが許可したかどうかを `ALLOWED` / `DENIED` で返します。

```js
const { ALLOWED, DENIED, HOST_USER, ANONYMOUS, write, seed } = require('./helpers');

test('未ログインでは新しいルームを作成できない', async () => {
    expect(await write(`rooms/${ROOM_ID}`, { playersCounter: 1 }, ANONYMOUS)).toBe(DENIED);
});
```

ルールを迂回してデータを用意したいときは `seed()`、書き込み結果を確認したいときは `readAsAdmin()` を使います。どちらも管理者権限で動くため、ルールの影響を受けません。

`beforeEach(clearDatabase)` がテストごとにデータベースを空にします。

### フィールドを追加したとき

ルールは未知のフィールドを拒否します。アプリに新しいフィールドを足したら、

1. `database.rules.template.json` にそのフィールドの `.validate` を書く
2. `tests/rules/database.rules.test.js` の「**作成から終了まで、アプリが書き込む値がすべて通る**」に、実際に書き込む値を追加する

この2番目のテストが、ルールとアプリの乖離を検出する要になっています。

---

## 検証していないもの

`areaParams` と `roundInfo` は、外部データ（マップ定義や GeoJSON の properties）に由来して構造が定まらないため、中身を検証していません。

---

## 本番へのデプロイ

ルールは `.github/workflows/deploy-database-rules.yml` が Secret `FIREBASE_ALLOWED_DOMAIN` から生成してデプロイします。

**ルールとホスティングは同時にデプロイしてください。** ルールだけ先に反映すると、古いコードからの書き込みがすべて拒否されます。
