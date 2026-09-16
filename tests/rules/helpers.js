// Realtime Database エミュレータの REST API を直接叩いてルールを検証する。
// @firebase/rules-unit-testing は firebase v9 以降を peer に要求し、
// 本体が使っている v8 と共存できないため採用していない。

// エミュレータは署名を検証しないので、ヘッダとペイロードだけ組み立てれば通る
const PROJECT = process.env.RULES_TEST_PROJECT || 'demo-map-detective';
// firebase.json のルールが適用されるのは既定のインスタンスだけ
const NAMESPACE = process.env.RULES_TEST_NAMESPACE || `${PROJECT}-default-rtdb`;
const HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';

// scripts/test-rules.sh が渡す FIREBASE_ALLOWED_DOMAIN と同じ値を保つこと
const ALLOWED_DOMAIN = '@example.com';
const ALLOWED_EMAIL = `host${ALLOWED_DOMAIN}`;

const ALLOWED = 'allowed';
const DENIED = 'denied';

function base64url(value) {
    return Buffer.from(value)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function authToken({
    uid = 'test-uid',
    email = ALLOWED_EMAIL,
    emailVerified = true,
    signInProvider = 'google.com',
} = {}) {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: `https://securetoken.google.com/${PROJECT}`,
        aud: PROJECT,
        sub: uid,
        user_id: uid,
        iat: now,
        exp: now + 3600,
        auth_time: now,
        email,
        email_verified: emailVerified,
        firebase: {
            sign_in_provider: signInProvider,
            identities: { email: [email] },
        },
    };

    return [
        base64url(JSON.stringify({ alg: 'none', typ: 'JWT' })),
        base64url(JSON.stringify(payload)),
        '',
    ].join('.');
}

// 許可アカウントでの Google ログイン。ルームを作成できる唯一の立場
const HOST_USER = authToken({ uid: 'host' });
// 許可されていないドメインのアカウント
const OUTSIDER_USER = authToken({ uid: 'outsider', email: 'someone@evil.test' });
// 許可ドメインだがメール未確認
const UNVERIFIED_USER = authToken({ uid: 'unverified', emailVerified: false });
// 許可ドメインだが Google 以外でのログイン
const PASSWORD_USER = authToken({ uid: 'password', signInProvider: 'password' });
// 未ログインの参加者。ルーム参加時はこの立場で書き込む
const ANONYMOUS = null;

async function request(method, path, { token, body, admin } = {}) {
    const query = new URLSearchParams({ ns: NAMESPACE });
    if (token) {
        query.set('auth', token);
    }

    const response = await fetch(
        `http://${HOST}/${path}.json?${query.toString()}`,
        {
            method,
            // エミュレータはこのヘッダを管理者として扱い、ルールを迂回する
            ...(admin && { headers: { Authorization: 'Bearer owner' } }),
            ...(body !== undefined && { body: JSON.stringify(body) }),
        }
    );

    if (response.status === 200) {
        return ALLOWED;
    }
    if (response.status === 401 || response.status === 403) {
        return DENIED;
    }

    // 400（型やバリデーションの書式エラー）などは想定外なので落とす
    throw new Error(
        `想定外の応答: ${method} ${path} -> ${response.status} ${await response.text()}`
    );
}

const read = (path, token) => request('GET', path, { token });
const write = (path, value, token) =>
    request('PUT', path, { token, body: value });
const update = (path, value, token) =>
    request('PATCH', path, { token, body: value });
const remove = (path, token) => request('DELETE', path, { token });

// ルールを迂回してテスト用のデータを用意する
async function seed(path, value) {
    const result = await request('PUT', path, { admin: true, body: value });
    if (result !== ALLOWED) {
        throw new Error(`seed に失敗しました: ${path}`);
    }
}

// 書き込みが本当に反映されたかを確かめるため、ルールを迂回して値を読む
async function readAsAdmin(path) {
    const query = new URLSearchParams({ ns: NAMESPACE });
    const response = await fetch(
        `http://${HOST}/${path}.json?${query.toString()}`,
        { headers: { Authorization: 'Bearer owner' } }
    );
    return response.json();
}

async function clearDatabase() {
    const result = await request('DELETE', '', { admin: true });
    if (result !== ALLOWED) {
        throw new Error('データベースの初期化に失敗しました');
    }
}

module.exports = {
    ALLOWED,
    DENIED,
    ALLOWED_DOMAIN,
    ALLOWED_EMAIL,
    HOST_USER,
    OUTSIDER_USER,
    UNVERIFIED_USER,
    PASSWORD_USER,
    ANONYMOUS,
    authToken,
    read,
    write,
    update,
    remove,
    seed,
    readAsAdmin,
    clearDatabase,
};
