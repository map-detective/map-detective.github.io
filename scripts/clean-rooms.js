#!/usr/bin/env node

const admin = require('firebase-admin');
const yargs = require('yargs');

const argv = yargs
  .scriptName("clean-rooms")
  .usage('$0 -f <file-path> -c <database>')
  .option('file-path', {
    alias: 'f',
    describe: 'Path to the file to be uploaded',
    type: 'string',
    default: './keys.json'
  })
  .option('databaseUrl', {
    alias: 'd',
    description: 'realtime database url',
    type: 'string',
    default: 'https://clean-rooms.firebaseio.com/',
  })
  .help()
  .alias('help', 'h').argv;


const serviceAccount = require(argv.filePath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: argv.databaseUrl,
});

const db = admin.database();

// Delete all rooms 1 day passed since it was created
const ONE_DAY = 86400000;

db.ref('/')
    .once('value')
    .then((snapshot) => {
        const removals = [];

        snapshot.forEach((childSnapshot) => {
            if (childSnapshot.hasChild('createdAt')) {
                const createdAt = childSnapshot.child('createdAt').val();
                const difference = Date.now() - createdAt;

                if (difference > ONE_DAY) {
                    console.log('delete : ' + childSnapshot.key);
                    removals.push(childSnapshot.ref.remove());
                }
            } else {
                console.log('delete (no createdAt) : ' + childSnapshot.key);
                removals.push(childSnapshot.ref.remove());
            }
        });

        // 全ての削除が完了してから終了する
        return Promise.all(removals).then(() => {
            console.log('deleted : ' + removals.length + ' room(s)');
        });
    })
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
