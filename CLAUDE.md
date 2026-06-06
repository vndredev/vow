# CLAUDE.md

Dieses File leitet Claude Code (claude.ai/code) bei der Arbeit in diesem Repo an.

## Was das ist

**vow** — ein **spec-driven, LLM-first Generator für Vue**. Du beschreibst die App als Baum von **Vows** (Versprechen) in `app/<slug>.vow.md`; vow generiert eine type-safe Vue-App nach `.generated/`, die dir gehört (kein Runtime-Lock-in). Voll auf dem **VoidZero**-Stack (Vite+, Vitest, oxlint/oxfmt, tsgo), Ziel-Backend Cloudflare. pnpm-Monorepo mit der `vp`-CLI.

**Leitstern:** mit dem Core-Produkt eine komplette **Dashboard/Planungssystem-App** bauen — bedienbar von User **und** LLM. Vorgehen: slow, Element für Element, Function für Function.

## Befehle

- `vp check` — fmt + lint + typecheck (tsgo) über alle Pakete. Muss grün sein.
- **`pnpm -r test`** — Tests pro Paket (lokale `.bin`). **NICHT `vp test`** (Root): der globale `vp` findet projekt-lokale optionale peers wie `jsdom` nicht.
- `vp build apps/demo` — generiert `.generated/` + baut das Bundle.
- `vp dev apps/demo` — dev-Server (HMR: `app/*.vow.md` ändern → regeneriert + reload).
- `pnpm --filter @vow/docs run docs:build` / `docs:dev` — die VitePress-Docs.
- pre-commit (`vp staged`) läuft `vp check --fix`.

## Architektur (der Vertrag)

**Das Vow-Primitiv** (`@vow/core`): EIN rekursiver Knoten `{ id, slug, intent, kind?, of?, fields, fulfills?, proof }`. **Status wird NIE gespeichert** (abgeleitet). `parse.ts` (vow.md → Vow), `load.ts` (Ordner-Baum → Wald), `coverage.ts` (scenario-coverage).

**Fulfilment — wie ein Vow eingelöst wird:**

- `emit entity` → `<slug>.ts` (Typ + validierende `create<Name>`-Factory) + `<slug>.test.ts` (aus `## fields` abgeleitet) + `<Name>.vue` (Default-CRUD-Liste). [`@vow/emit-entity`, `@vow/emit-view`]
- `emit view` (`of: <entity>`) → zusätzliche `.vue`-Ansicht über derselben Entity. [`@vow/emit-view`]
- `bind <modul>#<export>` → handgeschriebener Code; vow generiert nur einen `.bind.ts`-Anker, den **tsgo** verifiziert (die Naht kann nicht lügen). [`@vow/emit-bind`]

**Primitive (headless, a11y):** `@vow/headless` = framework-agnostischer Kern (`checkbox(state,set)→api` — ARIA/Tastatur-Logik), dessen **a11y gegen die Plattform** getestet ist (Vanilla-DOM + axe, kein Framework). `@vow/emit-primitive` generiert den **unstyled** Vue-Adapter (nur `class` + `data-*`-Hooks). Nur bauen, was HTML nicht nativ kann — **kein Button** (`<button>` ist schon barrierefrei).

**Drei Zonen:** `app/` (Vows = Wahrheit, versioniert) ⟂ `.generated/` (Output, gitignored, NIE editiert) ⟂ `src/` (dünner Boot-Rahmen: `main.ts` + shims).

**Styling:** `@vow/theme` = austauschbares `vow.css` über die `class`/`data-*`-Hooks. Adapter bleiben unstyled; Theme optional (oder durch vndre.dev-Tokens ersetzbar) — kein Komponenten-Eingriff.

**Gate:** `@vow/gate` (`runGate`) generiert zuerst, sammelt dann jede prove über den ganzen Wald + jeden Test-Namen im Korpus, und verlangt via `uncoveredScenarios`: **jede prove hat einen grünen Test** (sonst rot). Als App-Test verdrahtet.

**Plugin:** `@vow/vite-plugin` (`vow()`) lädt `app/`, generiert `.generated/`, exponiert `virtual:vow/tree`, watcht `app/*.md` für HMR.

## Konventionen & Fallstricke

- Vows als **`<slug>.vow.md`** (slug IM Dateinamen, kein „index.js-Trap"). Verschachtelung über gleichnamigen `<slug>/`-Ordner.
- `id`: Regex `^[a-z]+_[a-z0-9]+$` — **genau EIN Unterstrich** (`vow_task`, nicht `vow_invoice_total`).
- Tests **immer** via `pnpm -r test` (lokale bins, jsdom-peer). Der globale `vp test` bricht an `jsdom`.
- **a11y gegen die Plattform** testen (Vanilla-DOM + axe), nicht ein Framework — die Wahrheit liegt im headless-Kern; der Adapter reicht nur durch.
- VitePress (`docs/`) läuft auf eigenem **Upstream-Vite** (scoped override `"vitepress>vite"`), nicht Vite+ (Vite+ entfernte `transformWithEsbuild` zugunsten oxc). `allowBuilds: esbuild`.
- Side-effect-Imports (`*.css`, `*.vue`) brauchen einen tsgo-shim (`src/env.d.ts`).

## Arbeitsweise (hart, von Andre)

- **Slow, Element für Element, Function für Function.** Erst planen, dann umsetzen. Pro Element: Code → grün (`vp check` + `pnpm -r test`) → **Doc-Seite** → vorlegen → Andre approved → nächstes.
- **Die Docs sind die nachvollziehbare Wahrheit** für User + LLM — der Ort, wo man alles versteht. Bei JEDEM Feature mitpflegen, **1:1 zum echten Stand**, kein Überversprechen, ehrlich (Foundation-phase markieren).
- **commit when green.** Push macht Andre interaktiv.
- Kein Mock als echte Daten ausgeben; Ursache statt Symptom lösen.

## Roadmap (zwei Stränge → Dashboard/Planungs-App)

- **Generierung** (was vow ausgibt): mehr field-types (date/select/reference) + Relationen → Primitive-Leiter (Switch/Dialog/Tabs/Select/Combobox/Table; Komplexes via Zag/Ark wrappen) → Patterns (Form/Table/Detail/Board/Stats) → Layout/Shell/Routing → Daten-Adapter (memory → CF D1).
- **Autoren-Schicht** (LLM-first): `serialize` (Vow → vow.md) → typed Mutations-API (`addEntity`/`addField`/…) → **vow-MCP-Server** (das LLM operiert vow über typed Tools).
- **Referenz-Produkt:** ein Dashboard/Planungssystem (Entities + Board/Kanban + Stats + CRUD + Persistenz), bedienbar von User + LLM.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
