import HistoryPage from '@/pages/HistoryPage';
import Home from '@/pages/Home';
import MedalsPage from '@/pages/MedalsPage';
import Vue from 'vue';
import Router from 'vue-router';
import { isValidRoomId } from '@/utils/room';

const StreetView = () => import('@/pages/StreetView');

const originalPush = Router.prototype.push;
Router.prototype.push = function push(location) {
    return originalPush.call(this, location).catch((err) => err);
};

Vue.use(Router);

export default new Router({
    mode: 'history',
    routes: [
        {
            path: '*',
            redirect: '/',
        },
        {
            path: '/',
            alias: '/index.html',
            name: 'home',
            component: Home,
        },
        {
            path: '/custom',
            name: 'home custom',
            component: Home,
            props: () => ({
                dialogCustomOpen: true,
            }),
        },
        {
            path: '/room/:roomName',
            name: 'Room',
            component: Home,
        },
        {
            path: '/history',
            name: 'History',
            component: HistoryPage,
        },
        {
            path: '/medals',
            name: 'Medals',
            component: MedalsPage,
        },
        {
            path: '/street-view/with-friends/:roomName',
            name: 'with-friends',
            component: StreetView,
            props: (route) => ({
                multiplayer: true,
                ...route.params,
                nbRoundSelected: route.params.nbRoundSelected
                    ? parseInt(route.params.nbRoundSelected, 10)
                    : 5,
            }),
            // 無効なIDはルール側でも拒否されるが、そちらは無言で失敗するため
            // 画面に入る前に弾いて home へ戻す
            beforeEnter: (to, from, next) => {
                if (!isValidRoomId(to.params.roomName)) {
                    return next({ name: 'home' });
                }
                next();
            },
        },
    ],
});
