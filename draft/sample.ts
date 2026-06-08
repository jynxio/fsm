/**
 * # Mermaid
 * stateDiagram-v2
 *     [*] --> LoggedOut
 *
 *     LoggedOut --> LoggingIn : StartLogin
 *
 *     state LoggingIn {
 *         [*] --> EnteringAccount
 *         EnteringAccount --> WaitingForDeviceCode : SubmitAccount
 *     }
 *
 *     LoggingIn --> LoggedIn : Success
 *     LoggingIn --> LoggedOut : Failure
 *
 *     LoggedIn --> [*]
 */
const statecharts = {
    states: {
        "logged-out": true, // true stand for initial state
        "logging-in": {
            "entering-account": true, // true stand for initial state
            "entering-2fa": null,
            "validating-2fa": null,
        },
        "logged-in": null,
    },
    transitions: {
        logout: ["*", "logged-out"],
        startLogin: ["logged-out", "logging-in"],

        submitAccount: ["logging-in.entering-account", "entering-2fa"],
        submit2fa: ["logging-in.entering-2fa", "validating-2fa"],
        resolveLogin: ["logging-in.validating-2fa", "logged-in"],
        rejectLogin: ["logging-in.validating-2fa", "logged-out"],
    },
};

/**
 * 注意：下述 2 个类型定义定死了要用上面的 statecharts，这是为了方便打草稿
 */
type Statecharts = typeof statecharts;
type StatechartsRunner = (
    i: Statecharts,
) =>
    | ["logged-out", (transitions: "startLogin" | "logged-out") => void]
    | ["logging-in.entering-account", (transitions: "submitAccount" | "logged-out") => void]
    | ["logging-in.entering-2fa", (transitions: "submit2fa" | "logged-out") => void]
    | [
          "logging-in.validating-2fa",
          (transitions: "resolveLogin" | "rejectLogin" | "logged-out") => void,
      ];
