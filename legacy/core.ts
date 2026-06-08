/**
 * A small statechart core: spec DSL + pure transition evaluator.
 *
 * Intentional omissions: runtime interpreter, actors, event queue, timers,
 * async lifecycle management, subscriptions, and effect execution.
 */

export type EventObject<TType extends string = string> = {
    readonly type: TType;
};

export type EventLike<TType extends string = string> = TType | EventObject<TType>;

export type EventType<TEvent> = TEvent extends string
    ? TEvent
    : TEvent extends EventObject<infer TType>
      ? TType
      : never;

type EventByType<TEvent, TType extends string> = TEvent extends string
    ? Extract<TEvent, TType>
    : TEvent extends EventObject<TType>
      ? TEvent
      : never;

type NarrowEvent<TEvent, TType extends string> = [EventByType<TEvent, TType>] extends [never]
    ? EventObject<TType>
    : EventByType<TEvent, TType>;

export type RegionValue<TTag extends string = string> = {
    readonly tag: TTag;
};

export interface RegionSpec<TTags extends string = string> {
    readonly kind: "region";
    readonly initial: TTags;
    readonly states: readonly TTags[];
}

export type RegionMap = Record<string, RegionSpec<string>>;

export interface ParallelSpec<TRegions extends RegionMap = RegionMap> {
    readonly kind: "parallel";
    readonly regions: TRegions;
}

export type AnyParallel = ParallelSpec<RegionMap>;

export type RegionsOf<TStructure extends AnyParallel> = TStructure["regions"];

export type TagsOf<TRegion> = TRegion extends RegionSpec<infer TTags> ? TTags : never;

export type PathOf<TStructure extends AnyParallel> = {
    [TRegion in keyof RegionsOf<TStructure> & string]: `${TRegion}.${TagsOf<RegionsOf<TStructure>[TRegion]> &
        string}`;
}[keyof RegionsOf<TStructure> & string];

export type StateOf<TStructure extends AnyParallel> = {
    readonly [TRegion in keyof RegionsOf<TStructure>]: RegionValue<TagsOf<RegionsOf<TStructure>[TRegion]>>;
};

export type TransitionPatch<S> = Partial<{
    readonly [TRegion in keyof S]: S[TRegion];
}>;

export interface TransitionStep<S, FX = never> {
    readonly kind: "step";
    readonly patch: TransitionPatch<S>;
    readonly effects: readonly FX[];
}

export type RuleOutput<S, FX = never> = TransitionStep<S, FX> | TransitionPatch<S> | undefined | null | false;

export interface TransitionResult<S, FX = never> {
    readonly state: S;
    readonly effects?: readonly FX[];
}

export interface RuleInput<S, E extends EventLike = EventLike> {
    readonly state: Readonly<S>;
    readonly event: E;
    readonly type: string;
}

export interface LocalRuleInput<S, E extends EventLike = EventLike> extends RuleInput<S, E> {
    readonly region: string;
    readonly source: string;
    readonly target: string;
    readonly sourcePath: string;
    readonly targetPath: string;
}

export type LocalGuard<S, E extends EventLike = EventLike> = {
    bivarianceHack(input: LocalRuleInput<S, E>): boolean;
}["bivarianceHack"];

export type CrossRegionGuard<S, E extends EventLike = EventLike> = {
    bivarianceHack(input: RuleInput<S, E>): boolean;
}["bivarianceHack"];

export type LocalReducer<S, E extends EventLike = EventLike> = {
    bivarianceHack(input: LocalRuleInput<S, E>): unknown;
}["bivarianceHack"];

export type LocalEffectProducer<S, E extends EventLike = EventLike, FX = never> = {
    bivarianceHack(input: LocalRuleInput<S, E>): readonly FX[];
}["bivarianceHack"];

export type LocalEffects<S, E extends EventLike = EventLike, FX = never> =
    | readonly FX[]
    | LocalEffectProducer<S, E, FX>;

export interface LocalTransitionOptions<S, E extends EventLike = EventLike, FX = never> {
    readonly guard?: LocalGuard<S, E>;
    readonly reduce?: LocalReducer<S, E>;
    readonly effects?: LocalEffects<S, E, FX>;
}

export interface LocalTransition<S = unknown, E extends EventLike = EventLike, FX = never> {
    readonly kind: "local";
    readonly source: string;
    readonly event: string;
    readonly target: string;
    readonly guard?: LocalGuard<S, E>;
    readonly reduce?: LocalReducer<S, E>;
    readonly effects?: LocalEffects<S, E, FX>;
}

export type CrossRegionHandler<S, E extends EventLike = EventLike, FX = never> = {
    bivarianceHack(input: RuleInput<S, E>): RuleOutput<S, FX>;
}["bivarianceHack"];

export interface CrossRegionOptions<S, E extends EventLike = EventLike> {
    readonly guard?: CrossRegionGuard<S, E>;
}

export interface CrossRegionRule<S = unknown, E extends EventLike = EventLike, FX = never> {
    readonly kind: "cross";
    readonly event: string;
    readonly guard?: CrossRegionGuard<S, E>;
    readonly run: CrossRegionHandler<S, E, FX>;
}

type StoredLocalTransition<FX> = LocalTransition<unknown, EventLike, FX>;

type StoredCrossRegionRule<FX> = CrossRegionRule<unknown, EventLike, FX>;

export interface ChartConfig<TStructure extends AnyParallel, FX = never> {
    readonly structure: TStructure;
    readonly transitions?: readonly StoredLocalTransition<FX>[];
    readonly crossRegion?: readonly StoredCrossRegionRule<FX>[];
}

export interface ChartSpec<
    TStructure extends AnyParallel = AnyParallel,
    S extends StateOf<TStructure> = StateOf<TStructure>,
    E extends EventLike = EventLike,
    FX = never,
> {
    readonly kind: "chart";
    readonly structure: TStructure;
    readonly transitions: readonly StoredLocalTransition<FX>[];
    readonly crossRegion: readonly StoredCrossRegionRule<FX>[];
    readonly types?: {
        readonly state: S;
        readonly event: E;
        readonly effect: FX;
    };
}

export function region<const TInitial extends string, const TRest extends readonly string[]>(
    initial: TInitial,
    ...rest: TRest
): RegionSpec<TInitial | TRest[number]> {
    const states = [initial, ...rest];
    assertUniqueStrings(states, "region states");

    return Object.freeze({
        kind: "region",
        initial,
        states,
    });
}

export function parallel<const TRegions extends RegionMap>(regions: TRegions): ParallelSpec<TRegions> {
    const entries = Object.entries(regions);

    if (entries.length === 0) {
        throw new Error("parallel() requires at least one region.");
    }

    for (const [name, spec] of entries) {
        if (!isRecord(spec) || spec.kind !== "region") {
            throw new Error(`Region "${name}" must be created with region().`);
        }
    }

    return Object.freeze({
        kind: "parallel",
        regions,
    });
}

export function tr<S = unknown, E extends EventLike = EventLike, FX = never>(
    source: string,
    event: string,
    target: string,
    options: LocalTransitionOptions<S, E, FX> = {},
): LocalTransition<S, E, FX> {
    assertNonEmptyString(source, "transition source");
    assertNonEmptyString(event, "transition event");
    assertNonEmptyString(target, "transition target");

    return Object.freeze({
        kind: "local",
        source,
        event,
        target,
        ...options,
    });
}

export function on<S = unknown, E extends EventLike = EventLike, FX = never>(
    event: string,
    run: CrossRegionHandler<S, E, FX>,
    options: CrossRegionOptions<S, E> = {},
): CrossRegionRule<S, E, FX> {
    assertNonEmptyString(event, "cross-region event");

    return Object.freeze({
        kind: "cross",
        event,
        run,
        ...options,
    });
}

export function patch<S, FX = never>(
    changes: TransitionPatch<S>,
    effects: readonly FX[] = [],
): TransitionStep<S, FX> {
    return Object.freeze({
        kind: "step",
        patch: changes,
        effects,
    });
}

export function none<S = Record<never, never>, FX = never>(
    effects: readonly FX[] = [],
): TransitionStep<S, FX> {
    return patch({} as TransitionPatch<S>, effects);
}

export function chart<
    const TStructure extends AnyParallel,
    S extends StateOf<TStructure> = StateOf<TStructure>,
    E extends EventLike = EventLike,
    FX = never,
>(config: ChartConfig<TStructure, FX>): ChartSpec<TStructure, S, E, FX> {
    const transitions = [...(config.transitions ?? [])];
    const crossRegion = [...(config.crossRegion ?? [])];

    validateChart(config.structure, transitions);

    return Object.freeze({
        kind: "chart",
        structure: config.structure,
        transitions,
        crossRegion,
    });
}

export function define<S, E extends EventLike = EventLike, FX = never>() {
    return Object.freeze({
        chart<const TStructure extends AnyParallel>(
            config: ChartConfig<TStructure, FX>,
        ): ChartSpec<TStructure, S & StateOf<TStructure>, E, FX> {
            return chart(config);
        },

        tr<const TType extends EventType<E> & string>(
            source: string,
            event: TType,
            target: string,
            options: LocalTransitionOptions<S, NarrowEvent<E, TType>, FX> = {},
        ): LocalTransition<S, NarrowEvent<E, TType>, FX> {
            return tr(source, event, target, options);
        },

        on<const TType extends EventType<E> & string>(
            event: TType,
            run: CrossRegionHandler<S, NarrowEvent<E, TType>, FX>,
            options: CrossRegionOptions<S, NarrowEvent<E, TType>> = {},
        ): CrossRegionRule<S, NarrowEvent<E, TType>, FX> {
            return on(event, run, options);
        },

        patch(changes: TransitionPatch<S>, effects: readonly FX[] = []): TransitionStep<S, FX> {
            return patch(changes, effects);
        },

        none(effects: readonly FX[] = []): TransitionStep<S, FX> {
            return none(effects);
        },
    });
}

export function initialState<const TStructure extends AnyParallel>(
    structure: TStructure,
): StateOf<TStructure>;
export function initialState<
    const TStructure extends AnyParallel,
    S extends StateOf<TStructure>,
    E extends EventLike,
    FX,
>(spec: ChartSpec<TStructure, S, E, FX>, overrides?: TransitionPatch<S>): S;
export function initialState(
    input: AnyParallel | ChartSpec<AnyParallel, StateOf<AnyParallel>, EventLike, unknown>,
    overrides: Record<string, unknown> = {},
): unknown {
    const structure = input.kind === "chart" ? input.structure : input;
    const state: Record<string, RegionValue> = {};

    for (const [name, spec] of Object.entries(structure.regions)) {
        state[name] = { tag: spec.initial };
    }

    return {
        ...state,
        ...overrides,
    };
}

export function transition<
    const TStructure extends AnyParallel,
    S extends StateOf<TStructure>,
    E extends EventLike,
    FX,
>(spec: ChartSpec<TStructure, S, E, FX>, state: S, event: E): TransitionResult<S, FX> {
    assertStateMatchesStructure(spec.structure, state);

    const type = readEventType(event);
    const steps: AppliedStep<S, FX>[] = [];

    for (const storedRule of spec.transitions) {
        const rule = storedRule as unknown as LocalTransition<S, E, FX>;

        if (rule.event !== type) {
            continue;
        }

        const source = parseKnownPath(spec.structure, rule.source, "transition source");
        const target = parseKnownPath(spec.structure, rule.target, "transition target");
        const current = readRegionValue(state, source.region);

        if (current.tag !== source.tag) {
            continue;
        }

        const input: LocalRuleInput<S, E> = {
            state,
            event,
            type,
            region: source.region,
            source: source.tag,
            target: target.tag,
            sourcePath: rule.source,
            targetPath: rule.target,
        };

        if (rule.guard && !rule.guard(input)) {
            continue;
        }

        const nextRegionState = rule.reduce ? rule.reduce(input) : { tag: target.tag };
        assertLocalTargetPatch(source.region, target.tag, nextRegionState, rule);
        const effects = resolveLocalEffects(rule.effects, input);

        steps.push({
            label: `${rule.source} --${rule.event}--> ${rule.target}`,
            step: patch({ [source.region]: nextRegionState } as TransitionPatch<S>, effects),
        });
    }

    for (const storedRule of spec.crossRegion) {
        const rule = storedRule as unknown as CrossRegionRule<S, E, FX>;

        if (rule.event !== type) {
            continue;
        }

        const input: RuleInput<S, E> = {
            state,
            event,
            type,
        };

        if (rule.guard && !rule.guard(input)) {
            continue;
        }

        steps.push({
            label: `on(${rule.event})`,
            step: normalizeOutput(rule.run(input)),
        });
    }

    return applySteps(spec.structure, state, steps);
}

interface ParsedPath {
    readonly region: string;
    readonly tag: string;
}

interface AppliedStep<S, FX> {
    readonly label: string;
    readonly step: TransitionStep<S, FX>;
}

function validateChart<FX>(structure: AnyParallel, transitions: readonly StoredLocalTransition<FX>[]): void {
    const bySourceAndEvent = new Map<string, StoredLocalTransition<FX>[]>();

    for (const rule of transitions) {
        const source = parseKnownPath(structure, rule.source, "transition source");
        const target = parseKnownPath(structure, rule.target, "transition target");

        if (source.region !== target.region) {
            throw new Error(
                `Local transition "${rule.source}" -> "${rule.target}" crosses regions. Use on(...) for cross-region rules.`,
            );
        }

        const key = `${rule.source}\u0000${rule.event}`;
        const existing = bySourceAndEvent.get(key) ?? [];

        if (existing.some((candidate) => !candidate.guard) || !rule.guard) {
            if (existing.length > 0) {
                throw new Error(
                    `Ambiguous transition: multiple unguarded rules for "${rule.source}" on "${rule.event}".`,
                );
            }
        }

        existing.push(rule);
        bySourceAndEvent.set(key, existing);
    }
}

function parseKnownPath(structure: AnyParallel, path: string, label: string): ParsedPath {
    const parsed = parsePath(path, label);
    const regionSpec = structure.regions[parsed.region];

    if (!regionSpec) {
        throw new Error(`${label} "${path}" uses unknown region "${parsed.region}".`);
    }

    if (!regionSpec.states.includes(parsed.tag)) {
        throw new Error(
            `${label} "${path}" uses unknown state "${parsed.tag}" in region "${parsed.region}".`,
        );
    }

    return parsed;
}

function parsePath(path: string, label: string): ParsedPath {
    const parts = path.split(".");

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error(`${label} "${path}" must use "region.state" form.`);
    }

    return {
        region: parts[0],
        tag: parts[1],
    };
}

function applySteps<TStructure extends AnyParallel, S extends StateOf<TStructure>, FX>(
    structure: TStructure,
    state: S,
    steps: readonly AppliedStep<S, FX>[],
): TransitionResult<S, FX> {
    const merged: Record<string, unknown> = {};
    const owners = new Map<string, string>();
    const effects: FX[] = [];

    for (const { label, step } of steps) {
        for (const [regionName, value] of Object.entries(step.patch)) {
            const previousOwner = owners.get(regionName);

            if (previousOwner) {
                throw new Error(
                    `Conflicting transition patches for region "${regionName}" on the same event: ${previousOwner} and ${label}.`,
                );
            }

            assertValidRegionPatch(structure, regionName, value);
            merged[regionName] = value;
            owners.set(regionName, label);
        }

        effects.push(...step.effects);
    }

    const nextState =
        Object.keys(merged).length === 0
            ? state
            : ({
                  ...(state as Record<string, unknown>),
                  ...merged,
              } as S);

    if (effects.length === 0) {
        return { state: nextState };
    }

    return {
        state: nextState,
        effects,
    };
}

function normalizeOutput<S, FX>(output: RuleOutput<S, FX>): TransitionStep<S, FX> {
    if (output === undefined || output === null || output === false) {
        return none<S, FX>();
    }

    if (isTransitionStep<S, FX>(output)) {
        return output;
    }

    if (!isRecord(output)) {
        throw new Error("Cross-region rule must return patch(...), none(), a patch object, or nothing.");
    }

    return patch(output as TransitionPatch<S>);
}

function resolveLocalEffects<S, E extends EventLike, FX>(
    effects: LocalEffects<S, E, FX> | undefined,
    input: LocalRuleInput<S, E>,
): readonly FX[] {
    if (!effects) {
        return [];
    }

    return typeof effects === "function" ? effects(input) : effects;
}

function assertStateMatchesStructure<TStructure extends AnyParallel, S extends StateOf<TStructure>>(
    structure: TStructure,
    state: S,
): void {
    for (const regionName of Object.keys(structure.regions)) {
        const value = readRegionValue(state, regionName);
        assertValidRegionPatch(structure, regionName, value);
    }
}

function assertValidRegionPatch(structure: AnyParallel, regionName: string, value: unknown): void {
    const spec = structure.regions[regionName];

    if (!spec) {
        throw new Error(`Patch uses unknown region "${regionName}".`);
    }

    if (!isRecord(value) || typeof value.tag !== "string") {
        throw new Error(`Patch for region "${regionName}" must be an object with a string tag.`);
    }

    if (!spec.states.includes(value.tag)) {
        throw new Error(`Patch for region "${regionName}" uses unknown state "${value.tag}".`);
    }
}

function assertLocalTargetPatch(
    regionName: string,
    targetTag: string,
    value: unknown,
    rule: LocalTransition<unknown, EventLike, unknown>,
): void {
    if (!isRecord(value) || value.tag !== targetTag) {
        throw new Error(
            `Local transition "${rule.source}" -> "${rule.target}" must produce tag "${targetTag}" for region "${regionName}".`,
        );
    }
}

function readRegionValue<S>(state: S, regionName: string): RegionValue {
    if (!isRecord(state)) {
        throw new Error("State must be an object.");
    }

    const value = state[regionName];

    if (!isRecord(value) || typeof value.tag !== "string") {
        throw new Error(`State region "${regionName}" must be an object with a string tag.`);
    }

    return value as RegionValue;
}

function readEventType(event: EventLike): string {
    if (typeof event === "string") {
        assertNonEmptyString(event, "event");
        return event;
    }

    if (isRecord(event) && typeof event.type === "string") {
        assertNonEmptyString(event.type, "event type");
        return event.type;
    }

    throw new Error("Event must be a string or an object with a string type.");
}

function isTransitionStep<S, FX>(value: unknown): value is TransitionStep<S, FX> {
    return isRecord(value) && value.kind === "step" && isRecord(value.patch) && Array.isArray(value.effects);
}

function assertUniqueStrings(values: readonly string[], label: string): void {
    const seen = new Set<string>();

    for (const value of values) {
        assertNonEmptyString(value, label);

        if (seen.has(value)) {
            throw new Error(`Duplicate ${label}: "${value}".`);
        }

        seen.add(value);
    }
}

function assertNonEmptyString(value: string, label: string): void {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${label} must be a non-empty string.`);
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
