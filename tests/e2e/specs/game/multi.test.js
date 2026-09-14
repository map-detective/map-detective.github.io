// https://docs.cypress.io/api/introduction/api.html

// マルチプレイは 2a1f53b〜a418118 でルーム作成フローが作り直されたため skip している。
// このテストが前提にしている以下の仕様は、いずれも現在は存在しない。
//   - ルーム名の入力欄（#inputRoomName）… ルーム名は CardRoomName.vue が自動発行する
//   - ホーム画面からルーム名を入力して既存ルームへ参加する導線
//     … 参加は招待URL /room/:roomName 経由のみ
// さらに、復活させるには以下の2点を回避する仕組みが必要になる。
//   - ルーム作成に signInHost の Google ログイン（signInWithPopup）が必須
//   - Realtime Database のルールにより、未認証では新規ルームを作成できないため
//     support/commands.js の createRoom / addPlayer が書き込めない
// Firebase Auth Emulator かカスタムトークンでホストのログインを差し替えたうえで、
// 招待URL経由の参加を検証する形に書き直すこと。
describe.skip('Multiplayer', () => {
    it('Create Multiplayer', () => {
        const id = Date.now().toString().slice(-5);

        cy.visit('/', {
            onBeforeLoad: (win) => {
                Object.defineProperty(win.navigator, 'language', {
                    value: 'en-EN',
                });
            },
        });
        cy.startGame(null, 'classic', null, id);
    });
    it('Join Multiplayer', () => {
        const id = Date.now().toString().slice(-5);
        cy.createRoom(id);
        cy.visit('/', {
            onBeforeLoad: (win) => {
                Object.defineProperty(win.navigator, 'language', {
                    value: 'en-EN',
                });
            },
        });

        cy.get('.search-box__btns > .primary > .v-btn__content').click();

        const card = cy.get('#card-roomname');
        card.get('.v-card__title span').contains(
            'Type a room name to create a new room or join a existing room'
        );
        card.get('#inputRoomName').type('cy' + id);

        card.get('#card-roomname .v-card__actions .v-btn:last-of-type').click();

        const cardPlayer = cy.get('#card-playername');
        cardPlayer.get('#inputPlayerName').type('T');

        cy.contains('#roundLabel', 1 + ' / 5');

        cy.get('#guess-button[disabled="disabled"]').should('be.visible');
        cy.get('#btnDown[disabled="disabled"]').should('not.exist');
        const btnDown = cy.get('#btnDown');
        btnDown.click();
        cy.setPositionGuess();
        cy.get('#guess-button:not([disabled="disabled"])').click();

        cy.get('.dialog-message__title')
            .contains('Waiting for other players...')
            .should('be.visible');

        cy.setPositionFirstPlayerFirebase(id);

        cy.get('.container-map--full').should('exist');
    });
});
