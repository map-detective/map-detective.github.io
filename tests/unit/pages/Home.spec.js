import Home from '@/pages/Home.vue';
import { createLocalVue, shallowMount } from '@vue/test-utils';
import appInit from '../testutils/appInit';

const args = appInit(createLocalVue(), false);
const $router = {
    push: jest.fn(),
};

describe('Home.vue', () => {
    it('表示しただけでは画面遷移しない', () => {
        shallowMount(Home, {
            ...args,
            mocks: {
                $route: {
                    params: {},
                },
                $router,
            },
        });
        expect($router.push).not.toBeCalled();
    });
});
