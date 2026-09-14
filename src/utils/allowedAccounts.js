/**
 * ルームを作成できる Google アカウントの一覧を扱う。
 *
 * 値の書式は scripts/build-database-rules.js が読む FIREBASE_ALLOWED_DOMAIN と同じ。
 *   - '@' で始まる要素 ... そのドメインのアカウントをすべて許可（例: @example.com）
 *   - それ以外の要素   ... そのメールアドレスのみ許可（例: alice@gmail.com）
 *
 * ここでの判定は、許可されていない理由をその場で伝えるためのもの。
 * 実際のアクセス制御は Realtime Database のセキュリティルールが担う。
 */

/**
 * カンマ区切りの設定値を、比較しやすい形に整えて配列で返す
 * @param {string} raw
 * @returns {string[]}
 */
export function parseAllowedAccounts(raw) {
    return String(raw || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value !== '');
}

/**
 * ビルド時に埋め込まれた許可アカウント一覧を返す。
 * 未設定の場合は空配列（＝クライアント側では判定しない）
 * @returns {string[]}
 */
export function getAllowedAccounts() {
    return parseAllowedAccounts(process.env.VUE_APP_ALLOWED_ACCOUNTS);
}

/**
 * メールアドレスが許可一覧に含まれるか
 * @param {string} email
 * @param {string[]} entries
 * @returns {boolean}
 */
export function isAllowedAccount(email, entries) {
    if (!email) return false;

    const normalized = String(email).trim().toLowerCase();

    return entries.some((entry) =>
        entry.startsWith('@')
            ? normalized.endsWith(entry)
            : normalized === entry
    );
}
