import { readFileSync } from "node:fs";

// The commit vocabulary is single-sourced in @vow/observability/commit-types.json — the same map the
// roadmap timeline colours each change by. Enforcing `type-enum` from it means the format the commit-msg
// hook guarantees is exactly the format the timeline reads. (commitlint runs under plain Node, so we read
// the JSON rather than import the TS package.)
const commitTypes = JSON.parse(
  readFileSync(new URL("./packages/observability/src/commit-types.json", import.meta.url), "utf8"),
);

export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        // Commits stay unattributed — no `Co-Authored-By` (or `Signed-off-by`) trailers.
        "no-trailers": (parsed) => [
          !/^(co-authored-by|signed-off-by):/im.test(parsed.raw ?? ""),
          "drop the Co-Authored-By / Signed-off-by trailer — keep commits unattributed",
        ],
      },
    },
  ],
  rules: {
    "type-enum": [2, "always", Object.keys(commitTypes)], // the timeline's known types (single source)
    "header-max-length": [2, "always", 72], // a concise subject
    "body-max-length": [2, "always", 600], // keep bodies short — no walls of text
    "no-trailers": [2, "always"],
  },
};
