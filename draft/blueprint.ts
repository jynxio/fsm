import type { KeyOf, Split } from "./misc/types.ts";

/**
 * Statechart
 */
type StateTree = { [state: string]: StateTree };
type TransitionDict<S extends StateTree = StateTree> = {
    readonly [action: string]: readonly [Exhaust.StatePatterns<S>, Exhaust.StatePath<S>];
};
type Blueprint<S extends StateTree = StateTree, T extends TransitionDict<S> = TransitionDict<S>> = {
    readonly states: S;
    readonly transitions?: T;
};

/**
 * Utilities
 */
type IsLeafStateNode<T extends StateTree> = KeyOf<T> extends never ? true : false;

type StatePathTransitionActionEntry<T extends Blueprint> = {
    [S in Exhaust.StatePath<T["states"]>]: [
        state: S,
        action: readonly Match.TransitionAction<T["transitions"], S>[],
    ];
}[Exhaust.StatePath<T["states"]>];

namespace Exhaust {
    type ExhaustStatePath<T extends StateTree> = {
        [K in KeyOf<T>]: IsLeafStateNode<T[K]> extends true ? K : `${K}.${ExhaustStatePath<T[K]>}`;
    }[KeyOf<T>];

    type ExhaustStatePatterns<T extends StateTree> =
        | "*"
        | {
              [K in KeyOf<T>]: IsLeafStateNode<T[K]> extends true
                  ? K
                  : `${K}.${ExhaustStatePatterns<T[K]>}` | `${K}.*`;
          }[KeyOf<T>];

    export type StatePath<T extends StateTree> = ExhaustStatePath<T>;
    export type StatePatterns<T extends StateTree> = ExhaustStatePatterns<T>;
}

namespace Match {
    type ExhaustStatePatterns<Path extends string> = Helper<Split<Path, ".">> | "*";

    type Helper<Segments extends string[], Prefix extends string = ""> = Segments extends [
        infer Head extends string,
        ...infer Rest extends string[],
    ]
        ? Rest extends []
            ? `${Prefix}${Head}`
            : `${Prefix}${Head}.*` | Helper<Rest, `${Prefix}${Head}.`>
        : never;

    type ExhaustTransitionAction<T extends Blueprint["transitions"], S extends string> = {
        [K in KeyOf<T>]: T[K] extends Readonly<[infer From, string]>
            ? From extends ExhaustStatePatterns<S>
                ? K
                : never
            : never;
    }[KeyOf<T>];

    export type TransitionAction<
        T extends Blueprint["transitions"],
        S extends string,
    > = ExhaustTransitionAction<T, S>;
}

export type { Blueprint, StateTree, TransitionDict };
export type { IsLeafStateNode, Exhaust, Match, StatePathTransitionActionEntry };
