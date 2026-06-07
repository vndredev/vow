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
    "header-max-length": [2, "always", 72], // a concise subject
    "body-max-length": [2, "always", 600], // keep bodies short — no walls of text
    "no-trailers": [2, "always"],
  },
};
