/*
 * The commit vocabulary is single-sourced in @vow/observability/commit-types.json — the same map the
 * roadmap timeline colours each change by. Enforcing `type-enum` from it means the format the commit-msg
 * hook guarantees is exactly the format the timeline reads. (commitlint runs under plain Node, so we read
 * the JSON directly rather than import the TS package.)
 */
import commitTypes from "./packages/observability/src/commit-types.json" with { type: "json" };

/** Commitlint severity for "error" (its rule tuples use a numeric level, 2 = error). */
const ERROR = 2;
/** A concise subject line — the conventional 72-column header budget. */
const HEADER_MAX = 72;
/** Keep bodies short — no walls of text. */
const BODY_MAX = 600;

/**
 * Reject the `Co-Authored-By` / `Signed-off-by` trailers — commits stay unattributed.
 *
 * @param {{ readonly raw?: string }} parsed - The parsed commit, carrying its `raw` text.
 * @returns {[boolean, string]} The commitlint rule outcome.
 */
function noTrailers(parsed) {
  return [
    !/^(co-authored-by|signed-off-by):/imu.test(parsed.raw ?? ""),
    "drop the Co-Authored-By / Signed-off-by trailer — keep commits unattributed",
  ];
}

export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [{ rules: { "no-trailers": noTrailers } }],
  rules: {
    "body-max-length": [ERROR, "always", BODY_MAX],
    "header-max-length": [ERROR, "always", HEADER_MAX],
    "no-trailers": [ERROR, "always"],
    "type-enum": [ERROR, "always", Object.keys(commitTypes)],
  },
};
