// セキュリティルールのテストはブラウザ環境も Vue も使わないため、
// 既存の jest.config.js（jsdom・カバレッジ収集あり）とは完全に分ける。
module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/rules/**/*.test.js'],
    collectCoverage: false,
    // トランスパイル不要な CommonJS で書くため、変換は挟まない
    transform: {},
    // エミュレータへの往復を伴うので既定の 5 秒では足りない
    testTimeout: 20000,
};
