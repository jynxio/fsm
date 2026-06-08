import { expect, test } from "vite-plus/test";
import { chart, define, initialState, on, parallel, patch, region, transition, tr } from "../src/index.ts";

test("local transitions update one region", () => {
    const structure = parallel({
        document: region("clean", "dirty", "saving"),
        network: region("online", "offline"),
    });

    const spec = chart({
        structure,
        transitions: [tr("document.clean", "CHANGE", "document.dirty")],
    });

    expect(transition(spec, initialState(spec), "CHANGE").state).toEqual({
        document: { tag: "dirty" },
        network: { tag: "online" },
    });
});

test("cross-region rules read previous state and emit effect data", () => {
    type DocumentState =
        | { tag: "clean"; doc: string }
        | { tag: "dirty"; doc: string; draft: string }
        | { tag: "saving"; doc: string; draft: string; requestId: string };

    type AppState = {
        document: DocumentState;
        network: { tag: "online" } | { tag: "offline" };
    };

    type AppEvent = { type: "SAVE"; requestId: string } | "DISCONNECT";
    type Effect = { type: "saveRequested"; requestId: string };

    const api = define<AppState, AppEvent, Effect>();
    const structure = parallel({
        document: region("clean", "dirty", "saving"),
        network: region("online", "offline"),
    });

    const spec = api.chart({
        structure,
        crossRegion: [
            api.on("SAVE", ({ event, state }) =>
                state.document.tag === "dirty" && state.network.tag === "online"
                    ? api.patch(
                          {
                              document: {
                                  tag: "saving",
                                  doc: state.document.doc,
                                  draft: state.document.draft,
                                  requestId: event.requestId,
                              },
                          },
                          [{ type: "saveRequested", requestId: event.requestId }],
                      )
                    : api.none(),
            ),
        ],
    });

    const result = transition(
        spec,
        {
            document: { tag: "dirty", doc: "a", draft: "b" },
            network: { tag: "online" },
        },
        { type: "SAVE", requestId: "r1" },
    );

    expect(result).toEqual({
        state: {
            document: { tag: "saving", doc: "a", draft: "b", requestId: "r1" },
            network: { tag: "online" },
        },
        effects: [{ type: "saveRequested", requestId: "r1" }],
    });
});

test("same-event patches conflict when they modify the same region", () => {
    const structure = parallel({
        document: region("clean", "dirty", "saving"),
        network: region("online", "offline"),
    });

    const spec = chart({
        structure,
        transitions: [tr("document.dirty", "SAVE", "document.saving")],
        crossRegion: [on("SAVE", () => patch({ document: { tag: "clean" } }))],
    });

    expect(() =>
        transition(
            spec,
            {
                document: { tag: "dirty" },
                network: { tag: "online" },
            },
            "SAVE",
        ),
    ).toThrow(/Conflicting transition patches/);
});
