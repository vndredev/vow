---
group: UI
order: 3
---

# The design language

vow describes an app as **intent** — a tree of vows, each a promise. The UI works the same way: a
component says **what it is**, and the design language resolves **how it looks**. You don't pick a
pixel or a shade; you name an intent, and vow renders it — consistently, every time, across every
generated surface. This is what turns a set of primitives into a UI framework, and it is what lets an
LLM describe rich UI and get a production-quality result by construction.

It is **100% vow**. There is no external UI library, no runtime lock-in, no borrowed look — vow's
primitives are hand-rolled and headless, accessibility is tested against the platform, and the base
look is vow's own (swappable through tokens, never a blank/unstyled state).

> **Foundation phase.** This page is the spec — the single source of truth the primitives, the
> emitters, and the theme are built against. Drafted first, reviewed, then the components follow.

## The four layers

```
intent          primary · row · destructive · section · caption …   ← what the author/LLM writes
  ↓ resolves to
tokens          variant · tone · size · density                     ← the raw vocabulary
  ↓ emitted as
data-*          data-variant · data-tone · data-size · data-density  ← framework-neutral hooks
  ↓ styled by
@vow/theme      one rule per token combination                      ← the swappable base look
```

The author (or the LLM) writes an **intent**. The emitter resolves it to **tokens**, emits them as
`data-*` hooks on the adapter (no framework lock-in, byte-stable), and `@vow/theme` carries one CSS
rule per token combination. Change the theme, the look changes; the intent and the markup don't.

## Layer 1 — the tokens

The raw, orthogonal vocabulary. A single `as const` source of truth (extending the variant/size
vocabulary already shared across the emitters and the theme), so a value can never drift between an
emitter and a style.

| Axis        | Values                                                           | Means                                                 |
| ----------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| **variant** | `solid` · `soft` · `outline` · `ghost` · `link`                  | the visual treatment (fill, tint, border, bare, text) |
| **tone**    | `neutral` · `accent` · `success` · `warning` · `danger` · `info` | the semantic colour role                              |
| **size**    | `xs` · `sm` · `md` · `lg` · `xl`                                 | the control scale                                     |
| **density** | `comfortable` · `compact`                                        | the spacing scale of a surface                        |

The key split: **variant is the treatment, tone is the colour.** They are independent — a
`outline · danger` button (a confirm-to-delete) and a `soft · success` badge are both expressible.
Conflating them (one "variant" axis doing both jobs) is what makes a UI read as all-one-weight.

## Layer 2 — the intents (the language)

An intent is a _named role_ that resolves to a fixed token set. The author names the role; the
language owns the mapping. This is where "where does which size belong" is **answered, not chosen.**

### Button / action

| Intent        | Where it belongs                         | → variant · size · tone     |
| ------------- | ---------------------------------------- | --------------------------- |
| `primary`     | the one main call-to-action on a surface | `solid` · `md` · `accent`   |
| `secondary`   | a supporting action beside the primary   | `soft` · `md` · `neutral`   |
| `subtle`      | a tertiary or toolbar action             | `ghost` · `sm` · `neutral`  |
| `row`         | an action inside a table/list row        | `ghost` · `sm` · `neutral`  |
| `toolbar`     | a compact action in a header/toolbar     | `ghost` · `sm` · `neutral`  |
| `destructive` | a confirmed destructive action           | `outline` · `md` · `danger` |

> A "Start work" button in a plan table is a `row` → `ghost · sm` automatically: compact, quiet,
> never a heavy fill. A form-footer submit is a `primary` → `solid · md`. One surface has exactly one
> `primary`. Consistency is structural, not a matter of taste applied per button.

### Status / badge

A status reads its tone from its meaning, never a hand-picked colour.

| Intent              | → variant · tone   |
| ------------------- | ------------------ |
| `planned` / idle    | `soft` · `neutral` |
| `doing` / active    | `soft` · `accent`  |
| `done` / success    | `soft` · `success` |
| `blocked` / error   | `soft` · `danger`  |
| `at-risk` / caution | `soft` · `warning` |

### Text

| Intent       | role                    |
| ------------ | ----------------------- |
| `page-title` | the H1 of a page        |
| `section`    | a section heading       |
| `label`      | a field/column label    |
| `body`       | running copy            |
| `caption`    | secondary/metadata text |
| `code`       | inline monospace        |

### Spacing & surface

| Spacing intent | between                                  |
| -------------- | ---------------------------------------- |
| `page`         | major page regions                       |
| `section`      | blocks within a section                  |
| `inline`       | controls in a row (e.g. an actions cell) |
| `dense`        | tight, data-heavy rows                   |

| Surface intent | → padding · border · shadow |
| -------------- | --------------------------- |
| `card`         | `md` · hairline · subtle    |
| `panel`        | `lg` · hairline · none      |
| `well`         | `md` · none · inset tint    |

## Layer 3 — context defaults

The language has **sensible defaults per context**, so the author/LLM specifies only the deviation.
A button resolves its intent from where it sits unless told otherwise:

| A button inside…                | defaults to                             |
| ------------------------------- | --------------------------------------- |
| a table/list row's actions cell | `row`                                   |
| a form footer                   | `primary` (first) then `secondary`      |
| a toolbar / page header         | `toolbar`                               |
| a dialog footer                 | `primary` (confirm) + `subtle` (cancel) |

So the common case is **zero ceremony**: an actions cell of buttons is compact and quiet by
construction; you reach for an explicit intent only to break the default. This is the LLM lever —
the model expresses structure ("this is the actions cell"), and the language supplies the styling.

## How it's wired (the whole path)

1. **DSL** — a `## view`/`## form` node names an intent (`button: { intent: primary }`), or inherits
   the context default; the LLM writes intent, never tokens.
2. **Resolution** — one committed module in `@vow/theme` (`src/design.ts`) holds the token vocabulary +
   the intent→token map + the context-default table. Pure, total, testable (pinned by `design.test.ts`).
3. **Emitter** — `@vow/emit-primitive` / `@vow/emit-view` resolve intent→tokens and emit `data-variant`
   / `data-tone` / `data-size` / `data-density` on the adapter — only `class` + `data-*`, no styling,
   byte-stable.
4. **Theme** — `@vow/theme` carries one rule per emittable token combination. A coverage test asserts
   every combination an emitter can emit has a matching selector (a seam that can't lie).

## Principles

- **Describe intent, not pixels.** The author/LLM names a role; vow owns the resolution.
- **Consistency by construction.** Two authors (or the LLM twice) can't produce a different look for
  the same intent.
- **100% vow.** No external library, no borrowed tokens, no runtime lock-in — vow's own headless
  primitives, vow's own design language, a11y tested against the platform.
- **Swappable, but polished by default.** The theme is replaceable through tokens; the default base
  look is production-quality out of the box, never blank.
- **The whole path or nothing.** A new intent or token is real only when the DSL can set it, the
  emitter resolves it, the theme styles it, and a test pins the seam.
