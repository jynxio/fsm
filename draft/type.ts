import type { StateTree, TransitionDict, Blueprint } from "./blueprint.ts";

function type<
    const S extends StateTree,
    const T extends TransitionDict<S>,
    const R extends Blueprint<S, T>,
>(statecharts: R): R {
    return statecharts;
}

export { type };
