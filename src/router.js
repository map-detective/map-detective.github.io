import HistoryPage from '@/pages/HistoryPage';
import Home from '@/pages/Home';
import MedalsPage from '@/pages/MedalsPage';
import Vue from 'vue';
import Router from 'vue-router';

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
            // 任意：無効IDを弾く保険
            beforeEnter: (to, from, next) => {
                const id = to.params.roomName;
                if (!id || /[.#$[\]]/.test(id)) return next({ name: 'home' });
                next();
            },
        },
    ],
});
