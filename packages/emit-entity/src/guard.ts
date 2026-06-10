/**
 * The presence seam for this package — `@vow/core`'s `defined` re-exported under a value-only path.
 *
 * The maximal lint wall couples two rules that, for `@vow/core`, are otherwise irreconcilable:
 * `consistent-type-specifier-style` forbids an inline `type` specifier (so a value and a type cannot
 * share one import statement), while `no-duplicate-imports` forbids two statements from one module. A
 * file that needs both `@vow/core`'s `defined` (value) and its `ReadonlyVow`/`ReadonlyField` (types)
 * thus sources the value here and keeps its direct `@vow/core` import type-only.
 */
export { defined } from "@vow/core";
