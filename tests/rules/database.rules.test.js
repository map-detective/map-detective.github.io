const {
    ALLOWED,
    DENIED,
    HOST_USER,
    OUTSIDER_USER,
    UNVERIFIED_USER,
    PASSWORD_USER,
    ANONYMOUS,
    read,
    write,
    update,
    remove,
    seed,
    readAsAdmin,
    clearDatabase,
} = require('./helpers');

// ルールが要求する 20〜64 文字の範囲で ID を組み立てる
function roomId(length = 22) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    while (id.length < length) {
        id += chars[id.length % chars.length];
    }
    return id;
}

const ROOM = roomId();
const roomPath = (id = ROOM) => `rooms/${id}`;

// ルームが既にある状態を作る。参加者の書き込みは全てこの状態が前提
const seedRoom = (id = ROOM) =>
    seed(roomPath(id), { playersCounter: 1, playerName: { player1: 'Host' } });

beforeEach(clearDatabase);

describe('ルームの作成', () => {
    test('許可アカウントは作成できる', async () => {
        expect(await write(roomPath(), { playersCounter: 1 }, HOST_USER)).toBe(
            ALLOWED
        );
    });

    test('未ログインでは作成できない', async () => {
        expect(await write(roomPath(), { playersCounter: 1 }, ANONYMOUS)).toBe(
            DENIED
        );
    });

    test('許可されていないドメインのアカウントでは作成できない', async () => {
        expect(
            await write(roomPath(), { playersCounter: 1 }, OUTSIDER_USER)
        ).toBe(DENIED);
    });

    test('メール未確認のアカウントでは作成できない', async () => {
        expect(
            await write(roomPath(), { playersCounter: 1 }, UNVERIFIED_USER)
        ).toBe(DENIED);
    });

    test('Google 以外のログインでは作成できない', async () => {
        expect(
            await write(roomPath(), { playersCounter: 1 }, PASSWORD_USER)
        ).toBe(DENIED);
    });
});

describe('参加者（未ログイン）', () => {
    beforeEach(() => seedRoom());

    test('既存のルームを読める', async () => {
        expect(await read(roomPath(), ANONYMOUS)).toBe(ALLOWED);
    });

    test('既存のルームに書き込める', async () => {
        expect(
            await update(roomPath(), { playersCounter: 2 }, ANONYMOUS)
        ).toBe(ALLOWED);
    });

    test('自分の名前を登録できる', async () => {
        expect(
            await write(`${roomPath()}/playerName/player2`, 'Toto', ANONYMOUS)
        ).toBe(ALLOWED);
    });

    test('ゲーム終了後にルームを削除できる', async () => {
        expect(await remove(roomPath(), ANONYMOUS)).toBe(ALLOWED);
    });

    test('サーバータイムスタンプで createdAt を書ける', async () => {
        expect(
            await write(
                `${roomPath()}/createdAt`,
                { '.sv': 'timestamp' },
                ANONYMOUS
            )
        ).toBe(ALLOWED);
    });
});

describe('ルームIDの形式', () => {
    test('20 文字ちょうどは作成できる', async () => {
        const id = roomId(20);
        expect(await write(roomPath(id), { playersCounter: 1 }, HOST_USER)).toBe(
            ALLOWED
        );
    });

    test('64 文字ちょうどは作成できる', async () => {
        const id = roomId(64);
        expect(await write(roomPath(id), { playersCounter: 1 }, HOST_USER)).toBe(
            ALLOWED
        );
    });

    test('19 文字は作成できない', async () => {
        const id = roomId(19);
        expect(await write(roomPath(id), { playersCounter: 1 }, HOST_USER)).toBe(
            DENIED
        );
    });

    test('65 文字は作成できない', async () => {
        const id = roomId(65);
        expect(await write(roomPath(id), { playersCounter: 1 }, HOST_USER)).toBe(
            DENIED
        );
    });

    test('使えない文字を含む ID は作成できない', async () => {
        const id = `${roomId(21)}!`;
        expect(await write(roomPath(id), { playersCounter: 1 }, HOST_USER)).toBe(
            DENIED
        );
    });

    test('短い ID のルームは、存在していても読めない', async () => {
        const id = roomId(10);
        await seed(roomPath(id), { playersCounter: 1 });
        expect(await read(roomPath(id), ANONYMOUS)).toBe(DENIED);
    });
});

describe('rooms の外', () => {
    test('ルート直下は読めない', async () => {
        expect(await read('', ANONYMOUS)).toBe(DENIED);
    });

    test('rooms 全体はまとめて読めない', async () => {
        await seedRoom();
        expect(await read('rooms', ANONYMOUS)).toBe(DENIED);
    });

    test('許可アカウントでも rooms の外には書けない', async () => {
        expect(await write('anything', { foo: 1 }, HOST_USER)).toBe(DENIED);
    });
});

describe('既存のフィールド検証', () => {
    beforeEach(() => seedRoom());

    test('playerName は 30 文字まで', async () => {
        expect(
            await write(
                `${roomPath()}/playerName/player2`,
                'a'.repeat(30),
                ANONYMOUS
            )
        ).toBe(ALLOWED);
        expect(
            await write(
                `${roomPath()}/playerName/player3`,
                'a'.repeat(31),
                ANONYMOUS
            )
        ).toBe(DENIED);
    });

    test('playerName は文字列でなければならない', async () => {
        expect(
            await write(`${roomPath()}/playerName/player2`, 42, ANONYMOUS)
        ).toBe(DENIED);
    });

    test('playersCounter は 1 以上 100 以下', async () => {
        expect(await write(`${roomPath()}/playersCounter`, 1, ANONYMOUS)).toBe(
            ALLOWED
        );
        expect(await write(`${roomPath()}/playersCounter`, 100, ANONYMOUS)).toBe(
            ALLOWED
        );
        expect(await write(`${roomPath()}/playersCounter`, 0, ANONYMOUS)).toBe(
            DENIED
        );
        expect(await write(`${roomPath()}/playersCounter`, 101, ANONYMOUS)).toBe(
            DENIED
        );
    });

    test('size は 1 以上 100 以下', async () => {
        expect(await write(`${roomPath()}/size`, 2, ANONYMOUS)).toBe(ALLOWED);
        expect(await write(`${roomPath()}/size`, 0, ANONYMOUS)).toBe(DENIED);
        expect(await write(`${roomPath()}/size`, 101, ANONYMOUS)).toBe(DENIED);
    });
});

// settings.store.js の GameSettings がルームに書き出す値と同じ形
const GAME_SETTINGS = {
    allPanorama: false,
    time: 300,
    timeLimitation: 300,
    modeSelected: 'classic',
    timeAttackSelected: false,
    zoomControl: true,
    moveControl: true,
    panControl: true,
    countdown: 0,
    scoreMode: 'normal',
    optimiseStreetView: true,
    nbRoundSelected: 5,
    scoreLeaderboard: true,
    guessedLeaderboard: true,
    difficulty: 2000,
    bboxObj: [-10, -20, 10, 20],
};

describe('ゲームの流れ', () => {
    // 実際にコードが書き込む値をそのまま順に流し、ルールが邪魔をしないことを確かめる
    test('作成から終了まで、アプリが書き込む値がすべて通る', async () => {
        // ホストがルームを作る
        expect(await write(roomPath(), { playersCounter: 1 }, HOST_USER)).toBe(
            ALLOWED
        );

        // 1 人目が名前と作成時刻を書く
        expect(
            await write(`${roomPath()}/playerName/player1`, 'Host', ANONYMOUS)
        ).toBe(ALLOWED);
        expect(
            await update(
                roomPath(),
                { createdAt: { '.sv': 'timestamp' } },
                ANONYMOUS
            )
        ).toBe(ALLOWED);

        // 2 人目が採番して名前を書く
        expect(
            await write(`${roomPath()}/playersCounter`, 2, ANONYMOUS)
        ).toBe(ALLOWED);
        expect(
            await write(`${roomPath()}/playerName/player2`, 'Toto', ANONYMOUS)
        ).toBe(ALLOWED);

        // ホストがゲーム設定を書く
        expect(await update(roomPath(), GAME_SETTINGS, ANONYMOUS)).toBe(
            ALLOWED
        );

        // ゲーム開始
        expect(
            await update(roomPath(), { size: 2, started: true }, ANONYMOUS)
        ).toBe(ALLOWED);
        expect(await write(`${roomPath()}/active`, true, ANONYMOUS)).toBe(
            ALLOWED
        );

        // ストリートビューの位置を共有する
        expect(
            await write(
                `${roomPath()}/streetView/round1`,
                {
                    latitude: -47.17523906165908,
                    longitude: -66.1606798240516,
                    roundInfo: { name: 'Somewhere', nested: { code: 'AR' } },
                    warning: false,
                },
                ANONYMOUS
            )
        ).toBe(ALLOWED);

        // 回答を共有する
        expect(
            await write(
                `${roomPath()}/guess/player1`,
                { latitude: -12.93, longitude: 161.8 },
                ANONYMOUS
            )
        ).toBe(ALLOWED);

        // ラウンドの結果を書く
        expect(
            await write(
                `${roomPath()}/round1/player1`,
                {
                    latitude: -12.93,
                    longitude: 161.8,
                    distance: 13896482,
                    points: 5,
                    timePassed: 12,
                },
                ANONYMOUS
            )
        ).toBe(ALLOWED);

        // ラウンドが終わったら回答を消す
        expect(await remove(`${roomPath()}/guess`, ANONYMOUS)).toBe(ALLOWED);

        // 最終スコア
        expect(
            await write(`${roomPath()}/finalScore/player1`, 13896482, ANONYMOUS)
        ).toBe(ALLOWED);
        expect(
            await write(`${roomPath()}/finalPoints/player1`, 5, ANONYMOUS)
        ).toBe(ALLOWED);
        expect(
            await write(`${roomPath()}/isGameDone/player1`, true, ANONYMOUS)
        ).toBe(ALLOWED);

        // 全員終わったらルームごと消える
        expect(await remove(`${roomPath()}/active`, ANONYMOUS)).toBe(ALLOWED);
        expect(await remove(roomPath(), ANONYMOUS)).toBe(ALLOWED);
    });

    test('国モードでは緯度経度の代わりに area を書く', async () => {
        await seedRoom();
        expect(
            await write(`${roomPath()}/guess/player1`, { area: 'JP' }, ANONYMOUS)
        ).toBe(ALLOWED);
        expect(
            await write(
                `${roomPath()}/round1/player1`,
                { area: 'JP', distance: 0, points: 5, timePassed: 3 },
                ANONYMOUS
            )
        ).toBe(ALLOWED);
    });

    test('構造が定まらない areaParams と roundInfo は自由に書ける', async () => {
        await seedRoom();
        expect(
            await write(
                `${roomPath()}/areaParams`,
                { data: { urlArea: 'https://example.com/a.json', pathKey: 'iso_a2' } },
                ANONYMOUS
            )
        ).toBe(ALLOWED);
        expect(
            await write(
                `${roomPath()}/streetView/round1/roundInfo`,
                { a: { b: { c: [1, 2, 3] } } },
                ANONYMOUS
            )
        ).toBe(ALLOWED);
    });
});

describe('スキーマの固定', () => {
    beforeEach(() => seedRoom());

    test('知らないフィールドはルーム直下に書けない', async () => {
        expect(await write(`${roomPath()}/whatever`, true, ANONYMOUS)).toBe(
            DENIED
        );
    });

    test('知らないフィールドは update に混ぜても書けない', async () => {
        expect(
            await update(roomPath(), { size: 2, whatever: true }, ANONYMOUS)
        ).toBe(DENIED);
        // 拒否された update は一部だけ通ることもない
        expect(await readAsAdmin(`${roomPath()}/size`)).toBeNull();
    });

    test('知らないフィールドは streetView に書けない', async () => {
        expect(
            await write(
                `${roomPath()}/streetView/round1/whatever`,
                true,
                ANONYMOUS
            )
        ).toBe(DENIED);
    });

    test('知らないフィールドは guess に書けない', async () => {
        expect(
            await write(`${roomPath()}/guess/player1/whatever`, true, ANONYMOUS)
        ).toBe(DENIED);
    });

    test('知らないフィールドはラウンド結果に書けない', async () => {
        expect(
            await write(`${roomPath()}/round1/player1/whatever`, true, ANONYMOUS)
        ).toBe(DENIED);
    });

    test('ラウンド名は round + 1〜2 桁の数字', async () => {
        expect(
            await write(`${roomPath()}/round99/player1`, { points: 1 }, ANONYMOUS)
        ).toBe(ALLOWED);
        expect(
            await write(`${roomPath()}/round100/player1`, { points: 1 }, ANONYMOUS)
        ).toBe(DENIED);
        expect(
            await write(`${roomPath()}/roundX/player1`, { points: 1 }, ANONYMOUS)
        ).toBe(DENIED);
    });

    test('プレイヤー名のキーは player + 数字', async () => {
        expect(
            await write(`${roomPath()}/playerName/admin`, 'Toto', ANONYMOUS)
        ).toBe(DENIED);
        expect(
            await write(`${roomPath()}/playerName/player1000`, 'Toto', ANONYMOUS)
        ).toBe(DENIED);
    });
});

describe('値の型と範囲', () => {
    beforeEach(() => seedRoom());

    test('createdAt は数値でなければならない', async () => {
        expect(
            await write(`${roomPath()}/createdAt`, 'now', ANONYMOUS)
        ).toBe(DENIED);
    });

    test('started は真偽値でなければならない', async () => {
        expect(await write(`${roomPath()}/started`, 'yes', ANONYMOUS)).toBe(
            DENIED
        );
    });

    test('modeSelected は決められた値だけ', async () => {
        expect(
            await write(`${roomPath()}/modeSelected`, 'country', ANONYMOUS)
        ).toBe(ALLOWED);
        expect(
            await write(`${roomPath()}/modeSelected`, 'anything', ANONYMOUS)
        ).toBe(DENIED);
    });

    test('scoreMode は決められた値だけ', async () => {
        expect(await write(`${roomPath()}/scoreMode`, 'time', ANONYMOUS)).toBe(
            ALLOWED
        );
        expect(
            await write(`${roomPath()}/scoreMode`, 'anything', ANONYMOUS)
        ).toBe(DENIED);
    });

    test('nbRoundSelected は 1 以上 99 以下', async () => {
        expect(
            await write(`${roomPath()}/nbRoundSelected`, 99, ANONYMOUS)
        ).toBe(ALLOWED);
        expect(
            await write(`${roomPath()}/nbRoundSelected`, 100, ANONYMOUS)
        ).toBe(DENIED);
        expect(await write(`${roomPath()}/nbRoundSelected`, 0, ANONYMOUS)).toBe(
            DENIED
        );
    });

    test('緯度経度は範囲内でなければならない', async () => {
        expect(
            await write(
                `${roomPath()}/streetView/round1/latitude`,
                91,
                ANONYMOUS
            )
        ).toBe(DENIED);
        expect(
            await write(
                `${roomPath()}/streetView/round1/longitude`,
                181,
                ANONYMOUS
            )
        ).toBe(DENIED);
    });

    test('bboxObj は 4 つの数値', async () => {
        expect(
            await write(`${roomPath()}/bboxObj`, [1, 2, 3, 4], ANONYMOUS)
        ).toBe(ALLOWED);
        expect(
            await write(`${roomPath()}/bboxObj`, [1, 2, 3, 4, 5], ANONYMOUS)
        ).toBe(DENIED);
        expect(
            await write(`${roomPath()}/bboxObj`, ['a', 'b', 'c', 'd'], ANONYMOUS)
        ).toBe(DENIED);
    });

    test('スコアは負の数にできない', async () => {
        expect(
            await write(`${roomPath()}/finalPoints/player1`, -1, ANONYMOUS)
        ).toBe(DENIED);
        expect(
            await write(`${roomPath()}/round1/player1/distance`, -1, ANONYMOUS)
        ).toBe(DENIED);
    });
});
