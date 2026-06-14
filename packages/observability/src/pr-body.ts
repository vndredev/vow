/**
 * The PR-body gate — the same idea as commitlint on the title, applied to the body. The
 * `.github/PULL_REQUEST_TEMPLATE.md` defines Summary / What / Proof / Next, but a template is a plea: a
 * PR can ship a bare `Closes #N` and skip it. This makes the template mechanical — a missing or empty
 * section fails the build, so every PR carries its traceable record (what it does, the proof, what's
 * next). Pure (the caller passes the raw body string), so the rule is unit-testable.
 */

/** The HTML-comment placeholders the template ships (e.g. the `One line: …` hints). They are not real
    content, so they are stripped before a section is judged filled. */
const COMMENT_RE = /<!--[\s\S]*?-->/gu;

/** A markdown `## Heading` line — the section anchors the template is built from. */
const HEADING_RE = /^##\s+(.+?)\s*$/u;

/** A markdown bullet line (`- text`), the shape a `## What` item takes. */
const BULLET_RE = /^[-*]\s+(.+?)\s*$/u;

/** A `- [ ]` / `- [x]` task line — the `## Proof` checkboxes. */
const CHECKBOX_RE = /^[-*]\s+\[[\sxX]\]\s+/u;

/** The template's section headings. Next may be a literal "—", the rest need real content. */
const SUMMARY = "Summary";
const WHAT = "What";
const PROOF = "Proof";
const NEXT = "Next";

/** The proof gate requires all three checkboxes be present — vp check, pnpm -r test, the doc page. */
const REQUIRED_CHECKBOXES = 3;

/** A read-only lookup over a body's sections: the lines under a `## Heading`, or `[]` when the body never
    declares it. A function seam (not a bare `ReadonlyMap` parameter) so the strict
    `prefer-readonly-parameter-types` wall is satisfied without a cast. */
type Sections = (heading: string) => readonly string[];

/** Strip the template's HTML-comment placeholders, so an unfilled hint never counts as content. */
function stripComments(body: string): string {
  return body.replace(COMMENT_RE, "");
}

/** Split a comment-stripped body into a lookup over its `## Heading` sections. A preamble before the first
    heading is dropped — only the template's sections are judged. Each `## Heading` opens a section; the
    lines beneath it (until the next heading) are its content. */
function sections(body: string): Sections {
  const byHeading = new Map<string, string[]>();
  let current: string[] = [];
  for (const line of body.split("\n")) {
    const heading = HEADING_RE.exec(line)?.[1];
    if (typeof heading === "string") {
      current = [];
      byHeading.set(heading, current);
    } else {
      current.push(line);
    }
  }
  return (heading) => byHeading.get(heading) ?? [];
}

/** Whether any line is non-blank — the section carries real content. */
function hasText(lines: readonly string[]): boolean {
  return lines.some((line) => line.trim() !== "");
}

/** Whether at least one line is a bullet that is not the template's bare `-` placeholder. */
function hasBullet(lines: readonly string[]): boolean {
  return lines.some((line) => {
    const text = BULLET_RE.exec(line.trim())?.[1];
    return typeof text === "string" && text.trim() !== "";
  });
}

/** How many `- [ ]` / `- [x]` task lines the section carries. */
function checkboxCount(lines: readonly string[]): number {
  return lines.filter((line) => CHECKBOX_RE.test(line.trim())).length;
}

/** The message for a section that fails its check, or `[]` when it passes — flat-mapped into the report. */
function demand(ok: boolean, message: string): readonly string[] {
  if (ok) {
    return [];
  }
  return [message];
}

/**
 * Every way a PR body falls short of `.github/PULL_REQUEST_TEMPLATE.md`. Empty means the body is filled:
 * a `## Summary` line with text, at least one non-placeholder `## What` bullet, all three `## Proof`
 * checkboxes, and a `## Next` section. HTML-comment hints are stripped first, so the bare template (or a
 * lone `Closes #N`) fails. Lenient on phrasing — it checks structure, not prose. Pure.
 */
export function prBodyProblems(body: string): string[] {
  const linesOf = sections(stripComments(body));
  return [
    ...demand(hasText(linesOf(SUMMARY)), "## Summary is missing or empty — one line."),
    ...demand(hasBullet(linesOf(WHAT)), "## What needs at least one real bullet."),
    ...demand(
      checkboxCount(linesOf(PROOF)) >= REQUIRED_CHECKBOXES,
      `## Proof needs the ${REQUIRED_CHECKBOXES} checkboxes (vp check · pnpm -r test · the doc page).`,
    ),
    ...demand(hasText(linesOf(NEXT)), '## Next is missing — deferred work or "—".'),
  ];
}

/**
 * The PR-body scaffold — the template skeleton (Summary / What / Proof / Next) pre-filled with the
 * issue title and `Closes #N`, so an agent fills only the substance (What bullets, Proof ticks, Next
 * deferral) instead of reconstructing the structure by hand. The same structure `prBodyProblems` checks;
 * a freshly-emitted scaffold fails `--check` on `## What` (the bare `-` placeholder is not a real bullet)
 * — by design, so the agent MUST supply the bullets. Pure.
 */
export function prBodyScaffold(issue: number, title: string): string {
  return [
    "## Summary",
    "",
    title,
    "",
    "## What",
    "",
    "-",
    "",
    "## Proof",
    "",
    "- [ ] `vp check` green (format · lint · typecheck)",
    "- [ ] `pnpm -r test` green",
    "- [ ] the relevant **doc page** updated 1:1 with the change",
    "",
    "## Next",
    "",
    "—",
    "",
    `Closes #${issue}`,
  ].join("\n");
}
