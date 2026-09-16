<!-- CardRoomName.vue -->
<template>
    <!-- 招待リンクからの参加時は何も表示せず、そのままルームへ入る -->
    <div v-if="!needsSignIn" style="display: none"></div>

    <!-- 新規にルームを作る場合のみ、ホストとしてのログインを求める -->
    <v-card v-else id="card-roomname">
        <v-card-title>
            {{ $t('CardRoomName.hostSignInTitle') }}
        </v-card-title>

        <v-card-text>
            {{ $t('CardRoomName.hostSignInDescription') }}

            <v-alert
                v-if="errorMessage"
                class="mt-4 mb-0"
                type="error"
                dense
                text
            >
                {{ errorMessage }}
            </v-alert>
        </v-card-text>

        <v-card-actions>
            <v-btn color="error" text @click="$emit('cancel')">
                {{ $t('cancel') }}
            </v-btn>

            <v-spacer />

            <v-btn color="primary" :loading="signingIn" @click="signIn">
                {{ $t('CardRoomName.hostSignInButton') }}
            </v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
import { mapMutations, mapState } from 'vuex';
import { SETTINGS_SET_ROOM_ERROR } from '@/store/mutation-types';
import { generateRoomId } from '@/utils/room';

// ルートから来たIDを拾う（param名はプロジェクトのrouter定義に合わせて調整）
function getRoomIdFromRoute(vm) {
    const p = vm.$route?.params || {};
    // よくあるパターン（/room/:roomId）
    return p.roomId || p.id || p.roomName || null;
}

export default {
    name: 'CardRoomName',
    data() {
        return {
            isHostFlow: false,
            needsSignIn: false,
            signingIn: false,
            errorMessage: '',
        };
    },
    computed: {
        ...mapState('settingsStore', ['roomName', 'roomErrorMessage']),
    },
    watch: {
        // ルーム作成が拒否された場合（許可されていないアカウントなど）は、
        // 理由を伝えてログイン画面に戻し、別のアカウントで試せるようにする
        roomErrorMessage(message) {
            if (!message || !this.isHostFlow) return;

            this.errorMessage = message;
            this.needsSignIn = true;
            this.signingIn = false;
        },
    },
    async mounted() {
        // 1) 招待リンク（URL）で来た場合：そのIDで検索のみ（ログイン不要）
        const fromRoute = getRoomIdFromRoute(this);
        if (fromRoute) {
            // 親やストアに反映（v-model系を使っているならemitしておく）
            this.$emit('input', fromRoute);
            this.$emit('update:roomName', fromRoute);

            this.$store
                .dispatch('settingsStore/searchRoom', fromRoute)
                .finally(() => this.$emit('next'));
            return;
        }

        // 2) すでにストアにroomNameがある場合：それを使う（ログイン不要）
        if (this.roomName) {
            this.$store
                .dispatch('settingsStore/searchRoom', this.roomName)
                .finally(() => this.$emit('next'));
            return;
        }

        // 3) 新規作成フロー：許可されたアカウントでログイン済みかを確認する
        this.isHostFlow = true;

        const host = await this.$store.dispatch('settingsStore/getCurrentHost');
        if (host) {
            this.createRoom();
            return;
        }

        // ポップアップのブロックを避けるため、ログインは利用者の操作を起点にする
        this.needsSignIn = true;
    },
    methods: {
        ...mapMutations('settingsStore', {
            setRoomError: SETTINGS_SET_ROOM_ERROR,
        }),
        createRoom() {
            const pseudoName = generateRoomId();
            this.$emit('input', pseudoName);
            this.$emit('update:roomName', pseudoName);

            this.$store
                .dispatch('settingsStore/searchRoom', pseudoName)
                .finally(() => this.$emit('next'));
        },
        async signIn() {
            this.signingIn = true;
            this.errorMessage = '';
            // 前回の失敗を消しておかないと、同じ理由で再び失敗したときに検知できない
            this.setRoomError('');

            try {
                await this.$store.dispatch('settingsStore/signInHost');
                this.needsSignIn = false;
                this.createRoom();
            } catch (error) {
                // 設定漏れなどの切り分けができるよう、原因を必ず記録する
                // eslint-disable-next-line no-console
                console.error(
                    '[signInHost]',
                    error?.code,
                    error?.message,
                    error
                );

                // 利用者が自分でポップアップを閉じた場合はエラー表示しない
                const cancelled = [
                    'auth/popup-closed-by-user',
                    'auth/cancelled-popup-request',
                ].includes(error?.code);

                if (error?.code === 'app/account-not-allowed') {
                    // どのアカウントなら使えるのか分かるよう、他の失敗とは区別して伝える
                    this.errorMessage = this.$t(
                        'CardRoomName.hostSignInNotAllowed'
                    );
                } else if (!cancelled) {
                    this.errorMessage =
                        error?.code === 'auth/popup-blocked'
                            ? this.$t('CardRoomName.hostSignInPopupBlocked')
                            : this.$t('CardRoomName.hostSignInFailed');
                }
            } finally {
                this.signingIn = false;
            }
        },
    },
};
</script>
