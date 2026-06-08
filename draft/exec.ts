import type { Blueprint, Match, Exhaust } from "./blueprint.ts";

function exec<T extends Blueprint>(blueprint: T, initialStatePath: Exhaust.StatePath<T["states"]>) {
    let currStatePath = initialStatePath;

    return get;

    type Snapshot<T extends Blueprint> = {
        [S in Exhaust.StatePath<T["states"]>]: {
            state: S;
            actions: readonly Match.TransitionAction<T["transitions"], S>[];
        };
    }[Exhaust.StatePath<T["states"]>];

    function get(): Snapshot<T> {}
}
