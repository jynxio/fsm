import { type } from "./type.ts";

const contraction = type({
    states: {
        browsing: {},
        ordering: {
            "selecting-items": {},
            checkout: {
                address: {},
                payment: {},
                confirming: {},
            },
            submitted: {},
        },

        preparing: {},
        delivering: {},
        delivered: {},
        cancelled: {},
    },
    transitions: {
        action1: ["ordering.checkout.*", "ordering.checkout.confirming"],
        a: ["ordering.checkout.address", "browsing"],
    },
    lifecycles: {},
});

export { contraction };
