import { decomment } from "./framework.ts";
import { defined } from "@vow/core";

/**
 * The design-language coverage gate — every CSS class an emitter writes MUST be defined in the design
 * language (the layer stylesheets: `@vow/theme`'s `vow.css` for the shared look, plus each consumer's own
 * sheet — `@vow/docs` for prose, `@vow/shell` for chrome). The studio is itself a vow app; an emitted
 * `vow-*` class with no matching rule is the framework not trusting its own design system — bespoke
 * unstyled markup (the `.vow-loop__metric` that shipped flat text with zero CSS) that nothing but a
 * screenshot caught. This gate makes that drift MECHANICAL: an emitted class with no theme fails the
 * build, naming the class + its source file + the LLM-friendly remedy, so a primitives bypass can never
 * again slip past on looks.
 *
 * The caller passes the concatenated stylesheet text, so the rule stays pure — it only matches, never
 * reads the filesystem, exactly like the framework + provider neutrality gates — and unit-testable.
 */

/** A `vow-*` BEM token — a block (`vow-loop`), an element (`vow-loop__head`), or a modifier (`vow-loop--on`).
 *  Letters/digits/`_`/`-` only, so it stops at a space, a quote, or a `${` interpolation boundary. */
const VOW_TOKEN = /vow-[A-Za-z0-9_-]+/gu;

/** A `.vow-*` selector token in the stylesheet — group 1 is the bare class (no leading dot). Matches the
 *  class wherever it sits: a bare rule, a compound (`.vow-trace .vow-table`), an attribute selector
 *  (`.vow-badge[data-variant="x"]`), or a combinator (`.vow-roadmap__shipped > summary`). */
const CSS_CLASS = /\.(vow-[A-Za-z0-9_-]+)/gu;

/** The bare-class capture group of `CSS_CLASS` (group 0 includes the leading dot). */
const CSS_CLASS_GROUP = 1;

/** The element separator in a BEM token (`block__element`) — the boundary a child selector defines past. */
const ELEMENT_SEP = "__";

/** `String.indexOf`'s "not present" sentinel. */
const NOT_FOUND = -1;

/** A string literal in emitter source — double-quoted (group 1), single-quoted (group 2), or a template
 *  literal (group 3). The class an emitter writes is always one of these (a `value: "vow-…"` attr, or the
 *  class arg of a `classed(tag, "vow-…")`-style helper), so scanning literals finds every emitted class. */
const STRING_LITERAL = /"([^"]*)"|'([^']*)'|`([^`]*)`/gu;

/** The double-quoted-body capture group of `STRING_LITERAL`. */
const DOUBLE_QUOTED = 1;
/** The single-quoted-body capture group of `STRING_LITERAL`. */
const SINGLE_QUOTED = 2;
/** The template-literal-body capture group of `STRING_LITERAL` — defined only for a `` `…` `` match. */
const TEMPLATE_BODY = 3;

/** The whole-match group of a token-scan match (group 0 is the matched token itself). */
const WHOLE_MATCH = 0;

/** An interpolation opener inside a template literal — the boundary past which the class is built at
 *  runtime (`vow-view vow-view--${slug}`), so the trailing token is unverifiable, not statically themed. */
const INTERPOLATION = "${";

/** A class literal that names a selector rather than an emitted class — a `.vow-*` doc/probe string the
 *  emitters never write to an element (e.g. the framework gate's own `` `.vow-board` `` example). */
const SELECTOR_PROSE = ".vow-";

/** The `data-vow-source` provenance attribute — a `vow-` substring that is an attribute name, not a class. */
const SOURCE_ATTR = "data-vow-source";

/** One emitter source file to scan — its package-qualified path (`<pkg>/<name>`) and full contents, the same
 *  `{ file, source }` shape the framework + provider neutrality gates take. */
export interface EmitterSource {
  readonly file: string;
  readonly source: string;
}

/** The classes an emitter writes, split into the statically-verifiable tokens and the count of dynamic ones.
 *  A token built by interpolation/concatenation can't be checked against the stylesheet at lint time, so it
 *  is COUNTED (never silently dropped) — Andre's no-silent-caps rule — and the static tokens are enforced. */
export interface EmittedClasses {
  readonly tokens: readonly string[];
  readonly unverifiable: number;
}

/** An emitted class with no rule in the design language — the file it was written in, and the bare token. */
export interface DesignLanguageViolation {
  readonly file: string;
  readonly token: string;
}

/** Every `vow-*` token in a string (each match's whole token), via the shared token scanner. */
function allTokens(text: string): string[] {
  return [...text.matchAll(VOW_TOKEN)].map((match: readonly string[]) => match[WHOLE_MATCH] ?? "");
}

/** The complete `vow-*` tokens in the static head before a `${` interpolation. The text before the first
 *  `${` is static; whatever token ABUTS the boundary (a head ending in `-`/`_`, e.g. `vow-view--`) is the
 *  half the interpolation completes at runtime, so it is dropped — only the tokens that stand whole on
 *  their own (`vow-view`) are reported, never the dangling modifier prefix. */
function staticHeadTokens(head: string): string[] {
  const matches = allTokens(head);
  if (head.endsWith("-") || head.endsWith("_")) {
    return matches.slice(0, -1);
  }
  return matches;
}

/** The static `vow-*` tokens a single class literal contributes, plus whether its tail is interpolated.
 *  A template literal like `` `vow-view vow-view--${slug}` `` yields the complete leading token (`vow-view`)
 *  as static and flags the interpolated tail (`vow-view--…`) as unverifiable — the dangling `vow-view--`
 *  prefix is NOT reported as a static class, because the real class only exists at runtime. */
function tokensInLiteral(
  literal: string,
  interpolated: boolean,
): {
  readonly tokens: readonly string[];
  readonly unverifiable: boolean;
} {
  const cut = literal.indexOf(INTERPOLATION);
  const hasInterpolation = interpolated && cut !== NOT_FOUND;
  if (hasInterpolation) {
    return { tokens: staticHeadTokens(literal.slice(0, cut)), unverifiable: true };
  }
  return { tokens: allTokens(literal), unverifiable: false };
}

/** Whether a class literal is a real emitted class (not a `.vow-*` selector-prose string or the
 *  `data-vow-source` provenance attribute), and carries a `vow-` token worth scanning. */
function isClassLiteral(literal: string): boolean {
  if (literal.startsWith(SELECTOR_PROSE)) {
    return false;
  }
  if (literal.includes(SOURCE_ATTR)) {
    return false;
  }
  return literal.includes("vow-");
}

/** The body + interpolated-ness of one `STRING_LITERAL` match — the double/single body, or the template
 *  body (which alone carries a `${…}`, so a present template group marks the literal as interpolatable). */
function literalOf(match: readonly string[]): {
  readonly body: string;
  readonly interpolated: boolean;
} {
  const template = match[TEMPLATE_BODY];
  if (defined(template)) {
    return { body: template, interpolated: true };
  }
  return { body: match[DOUBLE_QUOTED] ?? match[SINGLE_QUOTED] ?? "", interpolated: false };
}

/** The per-literal token-scan results for every class literal in a source (comments stripped, so a JSDoc
 *  `vow-` example is never a class). Each result carries the literal's static tokens + its interpolated-ness. */
function scanClassLiterals(
  source: string,
): { readonly tokens: readonly string[]; readonly unverifiable: boolean }[] {
  const results: { readonly tokens: readonly string[]; readonly unverifiable: boolean }[] = [];
  for (const match of decomment(source).matchAll(STRING_LITERAL)) {
    const { body, interpolated } = literalOf(match);
    if (isClassLiteral(body)) {
      results.push(tokensInLiteral(body, interpolated));
    }
  }
  return results;
}

/**
 * The `vow-*` classes an emitter source writes — every static token across its string literals (de-duped),
 * with the interpolated tails counted as unverifiable. Comments are stripped first (a `vow-` class named
 * only in a JSDoc example is documentation, not an emitted class), so the JSDoc `vow-doc` examples never count.
 */
export function emittedClasses(source: string): EmittedClasses {
  const scanned = scanClassLiterals(source);
  const tokens = new Set(scanned.flatMap((result) => [...result.tokens]));
  const unverifiable = scanned.filter((result) => result.unverifiable).length;
  return { tokens: [...tokens], unverifiable };
}

/**
 * The `vow-*` tokens the design language defines — every `.vow-*` selector in `vow.css`, plus the block of
 * each element/modifier selector. A `.vow-issue-table__num` rule defines the block `vow-issue-table` (the
 * base namespace co-applied with a themed `.vow-table`), so a BEM block that exists only through its
 * elements still counts as themed. The boundary is the `__` element separator, never a bare prefix — so
 * `.vow-trace__detail-text` does NOT theme `vow-trace__detail` (a kebab continuation, not an element).
 */
export function themedClasses(css: string): Set<string> {
  const themed = new Set<string>();
  for (const match of css.matchAll(CSS_CLASS)) {
    const selector = match[CSS_CLASS_GROUP] ?? "";
    themed.add(selector);
    const elementAt = selector.indexOf(ELEMENT_SEP);
    if (elementAt !== NOT_FOUND) {
      themed.add(selector.slice(0, elementAt));
    }
  }
  return themed;
}

/**
 * Every emitted `vow-*` class with no rule in the design language — the drift this gate forbids. Pass the
 * emitter sources and the `vow.css` text; an empty result means every emitted class is themed. Each
 * violation names the file + the offending token; the caller turns it into the remedy ("theme it or compose
 * a primitive"). Pure — unit-testable without the filesystem.
 */
export function designLanguageViolations(
  sources: readonly EmitterSource[],
  css: string,
): DesignLanguageViolation[] {
  const themed = themedClasses(css);
  const violations: DesignLanguageViolation[] = [];
  for (const source of sources) {
    for (const token of emittedClasses(source.source).tokens) {
      if (!themed.has(token)) {
        violations.push({ file: source.file, token });
      }
    }
  }
  return violations;
}

/** The total count of unverifiable (interpolated/concatenated) class literals across the emitter sources —
 *  surfaced by the gate so dynamic classes are never a silent gap, only a tracked, reported number. */
export function unverifiableCount(sources: readonly EmitterSource[]): number {
  let total = 0;
  for (const source of sources) {
    total += emittedClasses(source.source).unverifiable;
  }
  return total;
}

/** The remedy line for one violation — the LLM-friendly correction the gate prints alongside the failure. */
export function remedy(violation: DesignLanguageViolation): string {
  return `class \`${violation.token}\` (in ${violation.file}) has no rule in the design language — theme it the token-only way (a \`.${violation.token}\` rule in vow.css or the consumer layer's sheet), or compose a primitive`;
}
