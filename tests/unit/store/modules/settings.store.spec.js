jest.mock('@/lang', ()=>{
    return {
        t: (k)=> k
    };
});

import { GAME_MODE } from '@/constants';
import * as MutationTypes from '@/store/mutation-types';
import { default as settingsStore, GameSettings } from '@/store/modules/settings.store';

describe('settingsStore.js', () => {
    it('SETTINGS_SET_GAME_SETTINGS', ()=>{
        let state = {gameSettings: new GameSettings()};
        expect(
            state.gameSettings.allPanorama).toBeFalsy();
        settingsStore.mutations[MutationTypes.SETTINGS_SET_GAME_SETTINGS](state, {allPanorama: true});
        expect(
            state.gameSettings.allPanorama).toBeTruthy();
        expect(state.gameSettings.modeSelected).toEqual('classic');

        settingsStore.mutations[MutationTypes.SETTINGS_SET_GAME_SETTINGS](state, {areaParams: {title: '111'}});
        expect(state.gameSettings.areaParams.title).toEqual('111');
        expect(state.gameSettings.modeSelected).toEqual(GAME_MODE.CUSTOM_AREA);

        settingsStore.mutations[MutationTypes.SETTINGS_SET_GAME_SETTINGS](state, {modeSelected: 'country'});
        expect(state.gameSettings.areaParams).toBeNull();
        expect(state.gameSettings.modeSelected).toEqual('country');
        expect(state.gameSettings.optimiseStreetView).toBeTruthy();

    });

    it('setPlayerName will commit playerName', ()=>{
        const commit = jest.fn();
        const state = { players: [], name: '' };
        settingsStore.actions.setPlayerName({ commit, state }, 'Toto');

        expect(commit).toBeCalledWith(
            MutationTypes.SETTINGS_SET_PLAYER_NAME,
            { playerName: 'Toto', invalid: false }
        );
    });

});
