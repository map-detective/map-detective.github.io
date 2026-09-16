import firebase from 'firebase/app';
import 'firebase/database';

// ルームは rooms/ 配下にまとめる。ルート直下に置くと、セキュリティルールで
// ルームと他のデータを区別できず、スキーマを固定できないため。
export const ROOMS_PATH = 'rooms';

// ルームIDの許容形式。セキュリティルール側の検証と同じ条件を保つこと。
export const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

const ROOM_ID_LENGTH = 22;
const ROOM_ID_CHARS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

// 招待リンクのIDを推測されるとルームを覗かれるため、Math.random ではなく
// 暗号論的乱数を使い、長さも十分に取る。
export function generateRoomId() {
    const values = new Uint8Array(ROOM_ID_LENGTH);
    window.crypto.getRandomValues(values);

    let id = '';
    for (const value of values) {
        // 文字種が 64 で 256 の約数のため、剰余を取っても偏りは出ない
        id += ROOM_ID_CHARS[value % ROOM_ID_CHARS.length];
    }

    return id;
}

export function isValidRoomId(roomName) {
    return typeof roomName === 'string' && ROOM_ID_PATTERN.test(roomName);
}

// ルームの参照は必ずここを通す。パスの組み立てが散らばると、
// 移動したときに直し漏れが出るため。
export function roomRef(roomName) {
    return firebase.database().ref(`${ROOMS_PATH}/${roomName}`);
}
