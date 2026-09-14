#!/usr/bin/env node

/**
 * database.rules.template.json のプレースホルダを実際の許可条件に置き換え、
 * デプロイ用の database.rules.json を生成する。
 *
 * 許可アカウントは環境変数 FIREBASE_ALLOWED_DOMAIN で指定する（カンマ区切り）。
 *   - '@' で始まる要素 ... そのドメインのアカウントをすべて許可（例: @example.com）
 *   - それ以外の要素   ... そのメールアドレスのみ許可（例: alice@gmail.com）
 *
 * 例: FIREBASE_ALLOWED_DOMAIN='@example.com,alice@gmail.com'
 */

const fs = require('fs');
const path = require('path');

const TEMPLATE = path.join(__dirname, '..', 'database.rules.template.json');
const OUTPUT = path.join(__dirname, '..', 'database.rules.json');
const PLACEHOLDER = '__HOST_CONDITION__';

// ルール式に埋め込むため、想定外の文字が混ざっていないことを必ず確認する
const DOMAIN_PATTERN = /^@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function fail(message) {
    console.error(`[build-database-rules] ${message}`);
    process.exit(1);
}

const raw = process.env.FIREBASE_ALLOWED_DOMAIN;

// 未設定のまま生成すると誰でもルームを作れるルールになってしまうため、ここで止める
if (!raw || raw.trim() === '') {
    fail('環境変数 FIREBASE_ALLOWED_DOMAIN が設定されていません。');
}

const entries = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value !== '');

if (entries.length === 0) {
    fail('FIREBASE_ALLOWED_DOMAIN に有効な値がありません。');
}

const terms = entries.map((entry, index) => {
    // 値そのものは CI のログに残るため出力しない（何番目かだけ示す）
    const position = `${index + 1} 番目の値`;

    if (entry.startsWith('@')) {
        if (!DOMAIN_PATTERN.test(entry)) {
            fail(`${position}はドメインの形式として不正です。`);
        }
        return `auth.token.email.endsWith('${entry}')`;
    }

    if (!EMAIL_PATTERN.test(entry)) {
        fail(`${position}はメールアドレスの形式として不正です。`);
    }
    return `auth.token.email == '${entry}'`;
});

// Google ログイン済みかつメール確認済みであることを必ず条件に含める
const condition = [
    'auth != null',
    "auth.token.firebase.sign_in_provider == 'google.com'",
    'auth.token.email_verified == true',
    `(${terms.join(' || ')})`,
].join(' && ');

const template = fs.readFileSync(TEMPLATE, 'utf8');

if (!template.includes(PLACEHOLDER)) {
    fail(`テンプレートに ${PLACEHOLDER} が見つかりません。`);
}

const rules = template.split(PLACEHOLDER).join(condition);

// 生成結果が壊れていないことを確認してから書き出す
try {
    JSON.parse(rules);
} catch (error) {
    fail(`生成されたルールが JSON として不正です: ${error.message}`);
}

fs.writeFileSync(OUTPUT, rules);

console.log(`[build-database-rules] ${OUTPUT} を生成しました。`);
console.log(`[build-database-rules] 許可対象: ${entries.length} 件`);
