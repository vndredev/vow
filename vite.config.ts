import type { DummyRuleMap, OxlintOverride } from "vite-plus/lint";
import { defineConfig } from "vite-plus";

/**
 * The maximal lint wall: every Oxlint category at `error`. The ONLY rules turned off are provably
 * impossible — a contradictory pair (you cannot satisfy both, so we keep the better side) or a rule whose
 * satisfaction would break vow's stack. Everything else stays on; the code is adapted to it. The full
 * `-D all` is enforced here via `categories`.
 */

/*
 * Genuinely contradictory: the rule and its opposite both fire, so you CANNOT satisfy both — keep the
 * better side, off the other. These are not a choice; they are logic.
 */
const OFF_CONTRADICTORY = {
  // ⊥ inline named exports.
  "import/exports-last": "off",
  // ⊥ inline named exports.
  "import/group-exports": "off",
  // ⊥ a named-export library API.
  "import/no-named-export": "off",
  // ⊥ named exports.
  "import/prefer-default-export": "off",
  // ⊥ prefer-await-to-then + promise-function-async — keep async/await.
  "oxc/no-async-await": "off",
  // ⊥ prefer-optional-chain — keep `?.`.
  "oxc/no-optional-chaining": "off",
  // ⊥ prefer-object-spread — keep spread.
  "oxc/no-rest-spread-properties": "off",
} satisfies DummyRuleMap;

// Satisfying them would BREAK vow's stack — not a style choice, a functional requirement.
const OFF_STACK = {
  // Vow targets node / Cloudflare; `node:` imports are intended.
  "import/no-nodejs-modules": "off",
  // Vow uses `../` within a package.
  "import/no-relative-parent-imports": "off",
} satisfies DummyRuleMap;

const RULE_OPTIONS = {
  // Declarations, but arrow consts ok.
  "func-style": ["error", "declaration", { allowArrowFunctions: true }],
  // A generic type parameter is conventional.
  "id-length": ["error", { exceptions: ["T"] }],
  // Forces the concern-split.
  "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
  // Array indices / lengths are not magic.
  "no-magic-numbers": ["error", { ignore: [-1, 0, 1] }],
} satisfies DummyRuleMap;

// Config files (Vite/commitlint) MUST default-export — a framework requirement, not a style choice.
const CONFIG_FILE_OVERRIDE = {
  files: ["**/*.config.{ts,js}"],
  rules: {
    "import/no-anonymous-default-export": "off",
    "import/no-default-export": "off",
  },
} satisfies OxlintOverride;

export default defineConfig({
  fmt: {},
  lint: {
    categories: {
      correctness: "error",
      pedantic: "error",
      perf: "error",
      restriction: "error",
      style: "error",
      suspicious: "error",
    },
    ignorePatterns: ["**/.generated/**", "**/dist/**"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    options: { typeAware: true, typeCheck: true },
    overrides: [CONFIG_FILE_OVERRIDE],
    plugins: ["typescript", "unicorn", "oxc", "import", "promise", "node"],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      ...OFF_CONTRADICTORY,
      ...OFF_STACK,
      ...RULE_OPTIONS,
    },
  },
  run: {
    cache: true,
  },
  /*
   * Format only — `vp check --fix` collides overlapping auto-fixes under the max wall and emits broken
   * syntax (stray braces, duplicate exports). The lint wall is enforced by `vp lint` in CI, not here.
   */
  staged: {
    "*": "vp fmt",
  },
});
