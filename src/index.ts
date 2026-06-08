/**
 * API Contract
 *
 * This file is not an implementation. It is the code-shaped contract for the
 * tiny statecharts runtime described in ../spec.md.
 *
 * Design center:
 * - A blueprint centralizes states and transitions.
 * - A runtime stores the current active leaf state.
 * - Users explicitly request every state change.
 * - TypeScript should guide which actions are legal for a known current state.
 */

// ---------------------------------------------------------------------------
// Blueprint shape
// ---------------------------------------------------------------------------

export type StateNode = true | null | StateTree;

export type StateTree = {
    readonly [state: string]: StateNode;
};

export type StatePath = string;

export type Wildcard = "*";

/**
 * Source may be a state path or the wildcard string "*".
 */
export type TransitionSource = string;

export type TransitionTarget = StatePath;

export type TransitionTuple = readonly [source: TransitionSource, target: TransitionTarget];

export type TransitionTable = {
    readonly [action: string]: TransitionTuple;
};

export type Blueprint<
    States extends StateTree = StateTree,
    Transitions extends TransitionTable = TransitionTable,
> = {
    readonly states: States;
    readonly transitions: Transitions;

    /**
     * Type-only anchor. Users never write this field.
     */
    readonly types?: {
        readonly state: LeafState<States>;
        readonly action: keyof Transitions & string;
    };
};

export type AnyBlueprint = Blueprint<StateTree, TransitionTable>;

/**
 * Declares a statechart blueprint.
 *
 * This function should be identity-like at runtime: it gives TypeScript a stable
 * place to preserve literal state and action names.
 */
export declare function chart<
    const States extends StateTree,
    const Transitions extends TransitionTable,
>(blueprint: { readonly states: States; readonly transitions: Transitions }): Blueprint<States, Transitions>;

// ---------------------------------------------------------------------------
// Path and action inference
// ---------------------------------------------------------------------------

type Join<Parent extends string, Child extends string> = `${Parent}.${Child}`;

type Keys<T> = keyof T & string;

export type StatePathOf<States extends StateTree> = {
    [State in Keys<States>]: States[State] extends StateTree
        ? State | Join<State, StatePathOf<States[State]>>
        : State;
}[Keys<States>];

export type LeafState<States extends StateTree> = {
    [State in Keys<States>]: States[State] extends StateTree ? Join<State, LeafState<States[State]>> : State;
}[Keys<States>];

export type StatesOf<Machine extends AnyBlueprint> =
    Machine extends Blueprint<infer States, TransitionTable> ? States : never;

export type TransitionsOf<Machine extends AnyBlueprint> =
    Machine extends Blueprint<StateTree, infer Transitions> ? Transitions : never;

export type ActionOf<Machine extends AnyBlueprint> = keyof TransitionsOf<Machine> & string;

export type SourceOf<Transition> = Transition extends readonly [infer Source extends string, StatePath]
    ? Source
    : never;

export type TargetOf<Transition> = Transition extends readonly [TransitionSource, infer Target extends string]
    ? Target
    : never;

/**
 * A parent source is active for every child leaf under it.
 *
 * Example:
 * - source "logging-in" matches current "logging-in.entering-2fa"
 * - source "logging-in.entering-2fa" only matches that exact leaf
 * - source "*" matches everything
 */
export type SourceMatchesState<Source extends string, Current extends string> = Source extends Wildcard
    ? true
    : Current extends Source | `${Source}.${string}`
      ? true
      : false;

export type ActionForState<Machine extends AnyBlueprint, Current extends string> = {
    [Action in ActionOf<Machine>]: SourceMatchesState<
        SourceOf<TransitionsOf<Machine>[Action]>,
        Current
    > extends true
        ? Action
        : never;
}[ActionOf<Machine>];

// ---------------------------------------------------------------------------
// Runtime shape
// ---------------------------------------------------------------------------

export type Snapshot<Machine extends AnyBlueprint> = {
    [Current in LeafState<StatesOf<Machine>>]: {
        readonly state: Current;

        /**
         * The available action names for this current state.
         *
         * This is metadata for users and adapters. The exact runtime container
         * can be an array, readonly tuple, or lazily computed value later.
         */
        readonly actions: readonly ActionForState<Machine, Current>[];
    };
}[LeafState<StatesOf<Machine>>];

export type ActionForSnapshot<
    Machine extends AnyBlueprint,
    Current extends Snapshot<Machine>,
> = Current extends {
    readonly state: infer State extends string;
}
    ? ActionForState<Machine, State>
    : never;

export type Runtime<Machine extends AnyBlueprint> = {
    /**
     * Read the current active leaf state.
     *
     * The return value is a discriminated union. Once user code narrows
     * `snapshot.state`, TypeScript can also narrow which actions are legal.
     */
    readonly get: () => Snapshot<Machine>;

    /**
     * Request a transition.
     *
     * The snapshot parameter is deliberate in this contract: it carries the
     * current state into TypeScript so `action` can be narrowed by state.
     *
     * Runtime implementation should still verify that the snapshot is fresh and
     * the action is legal. TypeScript guidance is not a substitute for runtime
     * validation.
     */
    readonly set: <const Current extends Snapshot<Machine>>(
        current: Current,
        action: ActionForSnapshot<Machine, Current>,
    ) => Snapshot<Machine>;
};

export type RunOptions<Machine extends AnyBlueprint> = {
    /**
     * Optional explicit initial state.
     *
     * If omitted, runtime should resolve the initial leaf from `true` markers in
     * the blueprint.
     */
    readonly state?: LeafState<StatesOf<Machine>>;
};

/**
 * Activates one blueprint instance.
 *
 * This is only a state holder plus typed transition boundary. It is not an
 * actor system, workflow engine, effect runner, event queue, or framework store.
 */
export declare function run<const Machine extends AnyBlueprint>(
    machine: Machine,
    options?: RunOptions<Machine>,
): Runtime<Machine>;

// ---------------------------------------------------------------------------
// Future extension points, not part of the first implementation
// ---------------------------------------------------------------------------

export type LifecycleTarget<Machine extends AnyBlueprint> =
    | StatePathOf<StatesOf<Machine>>
    | {
          readonly from?: StatePathOf<StatesOf<Machine>>;
          readonly to?: StatePathOf<StatesOf<Machine>>;
      };

export type LifecycleListener<Machine extends AnyBlueprint> = (event: {
    readonly from: LeafState<StatesOf<Machine>>;
    readonly to: LeafState<StatesOf<Machine>>;
    readonly action: ActionOf<Machine>;
}) => void;

/**
 * Possible future subscription shape.
 *
 * Lifecycle is the "when"; user code inside the listener owns the effect.
 */
export type Subscribe<Machine extends AnyBlueprint> = (
    target: LifecycleTarget<Machine>,
    listener: LifecycleListener<Machine>,
) => () => void;
