# scripts

運用まわりのスクリプトを置いています。いずれもリポジトリ内から直接実行するもので、
パッケージとして配布はしていません。

| ファイル | 用途 | 実行元 |
|---|---|---|
| `build-database-rules.js` | `database.rules.template.json` から `database.rules.json` を生成 | Deploy Database Rules ワークフロー、`test-rules.sh` |
| `clean-rooms.js` | 放置されたルームを Realtime Database から削除 | Clean Rooms ワークフロー（毎日 4 時 JST） |
| `test-rules.sh` | セキュリティルールのテスト（`npm run test:rules`） | 手元 |

`clean-rooms.js` だけが外部パッケージ（`firebase-admin` / `yargs`）を使うため、
このディレクトリに専用の `package.json` を置いています。ルート側の依存関係とは別管理です。

## build-database-rules.js

許可アカウントを環境変数 `FIREBASE_ALLOWED_DOMAIN` で渡すと、テンプレート内の
`__HOST_CONDITION__` を実際の条件式に置き換えたルールを生成します。

```bash
FIREBASE_ALLOWED_DOMAIN='@example.com' node scripts/build-database-rules.js
```

カンマ区切りで複数指定できます（`@example.com` はドメイン全体、`alice@gmail.com` は個別）。
値の形式が不正な場合と、未設定の場合は生成を中止します。誰でもルームを作れるルールが
できてしまうのを防ぐためです。

生成される `database.rules.json` は Secret の値を含むため、`.gitignore` の対象です。

## clean-rooms.js

作成から 1 日以上経過したルームと、`createdAt` を持たないルームを削除します。

リポジトリのルートから実行します。

```bash
npm ci --prefix scripts
node scripts/clean-rooms.js -f <サービスアカウント鍵のパス> -d <Realtime Database の URL>
```

| オプション | 内容 |
|---|---|
| `-f`, `--file-path` | サービスアカウントの秘密鍵 JSON のパス（既定: `./keys.json`） |
| `-d`, `--databaseUrl` | Realtime Database の URL |
| `-h`, `--help` | ヘルプ |

ワークフローでは Secret `FIREBASE_SERVICE_ACCOUNT` を一時ファイルに書き出して渡し、
ジョブ終了時に必ず削除しています。鍵ファイルはリポジトリに置かないでください。

## test-rules.sh

Java の PATH 解決 → ルール生成 → Firebase Emulator 起動 → Jest 実行までを行います。
Java 21 以上が必要です。詳細は [セキュリティルールのテスト](../reference/DATABASE_RULES_TEST.md)
を参照してください。
