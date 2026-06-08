import type { Blueprint, StatePathTransitionActionEntry, Exhaust } from "./blueprint.ts";

function exec<T extends Blueprint>(blueprint: T, initialState: Exhaust.StatePath<T["states"]>) {
    let isLive = true;
    let currStatePath = initialState;

    return [getEntry, kill];

    function getEntry(): StatePathTransitionActionEntry<T> {}

    function kill() {
        isLive = false;
    }
}
