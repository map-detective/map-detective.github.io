# GitHub Pages Setup for map-detective

GeoGuess クローン「map-detective」をGitHub Pagesでホスティングする場合、Google Maps APIキーやFirebase関連の情報については、該当リポジトリのRepositry Secretsへの設定が必要です。ここで設定された内容は、GitHub Actionsでのビルド時に参照されます。

1. [Firebase](FIREBASE_SETUP.md)と[Google Maps](GOOGLE_MAPS_SETUP.md)でAPIキーなどを取得します。
2. リポジトリの[Actions secrets and variables](https://github.com/map-detective/map-detective.github.io/settings/secrets/actions)にアクセスします。
3. Repository secretsの[New repositry secret]を押して、キーと値を追加していきます。

|Repositry secretのキー|値|
|:--|:--|
|GMAP_API_KEY|Google Maps APIキー|

|Repositry secretのキー|対応するFirebaseのキー|
|:--|:--|
|VUE_APP_FIREBASE_API_KEY|apiKey|
|VUE_APP_FIREBASE_AUTH_DOMAIN|authDomain|
|VUE_APP_FIREBASE_DATABASE_URL|databaseURL|
|VUE_APP_FIREBASE_PROJECT_ID|projectId|
|VUE_APP_STORAGE_BUCKET|storageBucket|
|VUE_APP_FIREBASE_MESSAGING_SENDER_ID|messagingSenderId|
|VUE_APP_FIREBASE_APP_ID|appId|
|VUE_APP_LIST_MAPS_JSON_URL|'https://maps.geoguess.games/maps.json'|

`VUE_APP_LIST_MAPS_JSON_URL`はゲームで利用するMAPカタログデータで、'https://maps.geoguess.games/maps.json'を指定すれば良いようです（おそらく、自作も可能）。

参考：[Maps json](MapsJson.md)

Firebaseの管理画面で取得できる値との対応付けは以下の通りです。

```json
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "VUE_APP_FIREBASE_API_KEY",
  authDomain: "VUE_APP_FIREBASE_AUTH_DOMAIN",
  databaseURL: "VUE_APP_FIREBASE_DATABASE_URL",
  projectId: "VUE_APP_FIREBASE_PROJECT_ID",
  storageBucket: "VUE_APP_STORAGE_BUCKET",
  messagingSenderId: "VUE_APP_FIREBASE_MESSAGING_SENDER_ID",
  appId: "VUE_APP_FIREBASE_APP_ID"
};
```

![](actions_secrets.png)
