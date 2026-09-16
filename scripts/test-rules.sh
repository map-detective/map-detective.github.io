#!/bin/sh
# Realtime Database のセキュリティルールをエミュレータ上で検証する。
set -e

cd "$(dirname "$0")/.."

# macOS には Java 未導入でも /usr/bin/java というスタブがあるため、
# コマンドの有無ではなく実際に起動できるかで判定する。
has_java() {
    java -version >/dev/null 2>&1
}

# エミュレータは Java 製だが、Homebrew の openjdk は keg-only で PATH に
# 入らないため、動く java が無ければここで補う。
if ! has_java; then
    for formula in openjdk openjdk@21 openjdk@25; do
        prefix=$(brew --prefix "$formula" 2>/dev/null) || continue
        if [ -x "$prefix/bin/java" ]; then
            PATH="$prefix/bin:$PATH"
            export PATH
            break
        fi
    done
fi

if ! has_java; then
    echo "[test-rules] Java が見つかりません。'brew install openjdk@21' を実行してください。" >&2
    exit 1
fi

# 本番のルールは Secret から生成されるため、テストでは固定の許可ドメインで生成する。
# この値は tests/rules/helpers.js の ALLOWED_DOMAIN と一致させること。
FIREBASE_ALLOWED_DOMAIN='@example.com' node scripts/build-database-rules.js

# demo- で始まるプロジェクトIDはエミュレータ専用で、認証情報を必要としない
PROJECT="${RULES_TEST_PROJECT:-demo-map-detective}"

# firebase.json のルールが適用されるのは既定のインスタンスだけで、
# 他の namespace を指定するとルール無し（全許可）になってしまう
NAMESPACE="$PROJECT-default-rtdb"

RULES_TEST_PROJECT="$PROJECT" \
RULES_TEST_NAMESPACE="$NAMESPACE" \
    npx firebase emulators:exec \
    --only database \
    --project "$PROJECT" \
    "npx jest --config jest.rules.config.js $*"
