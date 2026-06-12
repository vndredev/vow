import { expect, test } from "vite-plus/test";
import type { Component } from "../src/model.ts";
import { renderVueSfc } from "../src/index.ts";

// The checkbox adapter expressed as a canonical Component. Step 2 will build this same shape.
// Inside emit-primitive; here it is the proof that renderVueSfc can reproduce the real output.
const checkbox: Component = {
  doc: [
    "Generated checkbox adapter over @vow/headless. Logic + a11y live in the core — do not edit.",
    "Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).",
  ],
  events: [{ name: "update:modelValue", payload: "boolean" }],
  imports: [
    { from: "vue", names: ["computed"] },
    { from: "@vow/headless", names: ["checkbox"] },
  ],
  name: "Checkbox",
  props: [
    { name: "modelValue", tsType: "boolean" },
    { name: "label", tsType: "string" },
    { name: "disabled", optional: true, tsType: "boolean" },
  ],
  setup: [
    "const api = computed(() =>",
    "  checkbox({ checked: props.modelValue, disabled: props.disabled }, (next) =>",
    '    emit("update:modelValue", next.checked),',
    "  ),",
    ");",
  ],
  view: {
    attrs: [
      { expr: "api.rootProps", kind: "spread" },
      { kind: "static", name: "class", value: "vow-checkbox" },
    ],
    children: [
      {
        attrs: [
          { expr: "api.controlProps", kind: "spread" },
          { expr: "label", kind: "bound", name: "aria-label" },
          { kind: "static", name: "class", value: "vow-checkbox__control" },
        ],
        children: [
          {
            attrs: [
              { expr: "api.indicatorProps", kind: "spread" },
              { kind: "static", name: "class", value: "vow-checkbox__indicator" },
            ],
            children: [{ kind: "text", text: "✓" }],
            kind: "element",
            tag: "span",
          },
        ],
        kind: "element",
        tag: "button",
      },
      {
        attrs: [
          { expr: "api.labelProps", kind: "spread" },
          { kind: "static", name: "class", value: "vow-checkbox__label" },
        ],
        children: [{ expr: "label", kind: "interp" }],
        kind: "element",
        tag: "span",
      },
    ],
    kind: "element",
    tag: "span",
  },
};

// The byte-exact oracle: today's hand-written emit-primitive output. The migration is safe only when
// Reproduced character-for-character — indentation, blank lines, glyphs and all — by the renderer.
const EXPECTED_CHECKBOX = [
  `<script setup lang="ts">`,
  `// Generated checkbox adapter over @vow/headless. Logic + a11y live in the core — do not edit.`,
  `// Carries class + data-* hooks only; vow's base look lives in @vow/theme (swappable).`,
  `import { computed } from "vue";`,
  `import { checkbox } from "@vow/headless";`,
  ``,
  `const props = defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>();`,
  `const emit = defineEmits<{ "update:modelValue": [boolean] }>();`,
  ``,
  `const api = computed(() =>`,
  `  checkbox({ checked: props.modelValue, disabled: props.disabled }, (next) =>`,
  `    emit("update:modelValue", next.checked),`,
  `  ),`,
  `);`,
  `</script>`,
  ``,
  `<template>`,
  `  <span v-bind="api.rootProps" class="vow-checkbox">`,
  `    <button v-bind="api.controlProps" :aria-label="label" class="vow-checkbox__control">`,
  `      <span v-bind="api.indicatorProps" class="vow-checkbox__indicator">✓</span>`,
  `    </button>`,
  `    <span v-bind="api.labelProps" class="vow-checkbox__label">{{ label }}</span>`,
  `  </span>`,
  `</template>`,
  ``,
].join("\n");

test("renderVueSfc reproduces the checkbox SFC byte-for-byte (the migration oracle)", () => {
  expect(renderVueSfc(checkbox)).toBe(EXPECTED_CHECKBOX);
});

test("a structured SetupStep list renders into the Vue idiom (the same model React consumes)", () => {
  // The Vue adapter renders state -> ref, computed -> computed, a handler -> a function declaration,
  // A const verbatim — the SAME SetupStep list the React adapter renders into hooks. One model, two idioms.
  const comp: Component = {
    imports: [{ from: "vue", names: ["computed", "ref"] }],
    name: "Counter",
    setup: [
      { init: "0", kind: "state", name: "count" },
      { expr: "count.value * 2", kind: "computed", name: "doubled" },
      { body: ["count.value += 1;"], kind: "handler", name: "bump", params: "" },
      { expr: "'idle'", kind: "const", name: "label" },
    ],
    view: { attrs: [], children: [{ expr: "doubled", kind: "interp" }], kind: "element", tag: "p" },
  };
  const sfc = renderVueSfc(comp);
  expect(sfc).toContain("const count = ref(0);");
  expect(sfc).toContain("const doubled = computed(() => count.value * 2);");
  expect(sfc).toContain(["function bump() {", "  count.value += 1;", "}"].join("\n"));
  expect(sfc).toContain("const label = 'idle';");
});

test("a literal text node is HTML-escaped (& < > in order)", () => {
  const comp: Component = {
    name: "Heading",
    view: {
      attrs: [],
      children: [{ kind: "text", text: "a < b & c" }],
      kind: "element",
      tag: "h1",
    },
  };
  expect(renderVueSfc(comp)).toContain("<h1>a &lt; b &amp; c</h1>");
});

test("a raw node emits its HTML verbatim (no escaping) — the prose escape hatch", () => {
  const comp: Component = {
    name: "Code",
    view: {
      attrs: [],
      children: [{ html: '<pre class="shiki"><span>a &lt; b</span></pre>', kind: "raw" }],
      kind: "element",
      tag: "div",
    },
  };
  const out = renderVueSfc(comp);
  expect(out).toContain('<pre class="shiki"><span>a &lt; b</span></pre>');
  // Not double-escaped.
  expect(out).not.toContain("&amp;lt;");
});

test("a static attr value escapes the quote that delimits it (and & < >)", () => {
  const comp: Component = {
    name: "Field",
    view: {
      attrs: [{ kind: "static", name: "placeholder", value: 'say "hi" & <go>' }],
      children: [],
      kind: "element",
      tag: "input",
    },
  };
  expect(renderVueSfc(comp)).toContain(
    '<input placeholder="say &quot;hi&quot; &amp; &lt;go&gt;" />',
  );
});

test("a void element renders self-closing (<input … />)", () => {
  const comp: Component = {
    name: "Field",
    view: {
      attrs: [
        { kind: "static", name: "class", value: "vow-view__input" },
        { expr: "draft.x", kind: "bound", name: "value" },
      ],
      children: [],
      kind: "element",
      tag: "input",
    },
  };
  expect(renderVueSfc(comp)).toContain('<input class="vow-view__input" :value="draft.x" />');
});

test("a default import renders as `import X from …`", () => {
  const comp: Component = {
    imports: [{ default: "Checkbox", from: "./Checkbox.vue" }],
    name: "Host",
    view: { attrs: [], children: [], kind: "element", tag: "div" },
  };
  expect(renderVueSfc(comp)).toContain('import Checkbox from "./Checkbox.vue";');
});

test("event and model attributes render with modifiers", () => {
  const comp: Component = {
    name: "Form",
    view: {
      attrs: [{ expr: "add", kind: "event", modifiers: ["prevent"], name: "submit" }],
      children: [
        {
          attrs: [{ expr: "draft.count", kind: "model", modifiers: ["number"] }],
          children: [],
          kind: "element",
          tag: "input",
        },
        {
          attrs: [{ expr: "remove(i)", kind: "event", name: "click" }],
          children: [{ kind: "text", text: "x" }],
          kind: "element",
          tag: "button",
        },
      ],
      kind: "element",
      tag: "form",
    },
  };
  const sfc = renderVueSfc(comp);
  expect(sfc).toContain('<form @submit.prevent="add">');
  expect(sfc).toContain('<input v-model.number="draft.count" />');
  expect(sfc).toContain('<button @click="remove(i)">x</button>');
});

test("a cond attr renders v-if (mount/unmount) and v-show (visibility)", () => {
  const ifNode: Component = {
    name: "Maybe",
    view: {
      attrs: [{ expr: "api.open", kind: "cond", type: "if" }],
      children: [],
      kind: "element",
      tag: "div",
    },
  };
  expect(renderVueSfc(ifNode)).toContain('<div v-if="api.open" />');

  const showNode: Component = {
    name: "Maybe",
    view: {
      attrs: [{ expr: "api.open", kind: "cond", type: "show" }],
      children: [],
      kind: "element",
      tag: "div",
    },
  };
  expect(renderVueSfc(showNode)).toContain('<div v-show="api.open" />');
});

test("a looped element renders v-for with key", () => {
  const comp: Component = {
    name: "List",
    view: {
      attrs: [],
      children: [
        {
          attrs: [{ kind: "static", name: "class", value: "vow-view__row" }],
          children: [{ expr: "item.title", kind: "interp" }],
          for: { as: "item", each: "rows", index: "i", key: "i" },
          kind: "element",
          tag: "li",
        },
      ],
      kind: "element",
      tag: "ul",
    },
  };
  expect(renderVueSfc(comp)).toContain(
    '<li class="vow-view__row" v-for="(item, i) in rows" :key="i">{{ item.title }}</li>',
  );
});

test("a slot renders a static, dynamic (:name), or default name", () => {
  const named: Component = {
    name: "Panel",
    view: { children: [], kind: "slot", name: "header" },
  };
  expect(renderVueSfc(named)).toContain('<slot name="header" />');

  const dynamic: Component = {
    name: "Panel",
    view: { children: [], kind: "slot", nameExpr: "item" },
  };
  expect(renderVueSfc(dynamic)).toContain('<slot :name="item" />');

  const fallback: Component = {
    name: "Panel",
    view: { children: [], kind: "slot" },
  };
  expect(renderVueSfc(fallback)).toContain("<slot />");
});

test("an empty component renders self-closing (<Checkbox … />)", () => {
  const comp: Component = {
    name: "Host",
    view: {
      attrs: [
        { expr: "item.done", kind: "model" },
        { kind: "static", name: "label", value: "done" },
      ],
      children: [],
      kind: "component",
      name: "Checkbox",
    },
  };
  expect(renderVueSfc(comp)).toContain('<Checkbox v-model="item.done" label="done" />');
});

test("an inline element keeps children on one line (select with options)", () => {
  const comp: Component = {
    name: "Picker",
    view: {
      attrs: [{ expr: "draft.status", kind: "model" }],
      children: [
        {
          attrs: [{ kind: "static", name: "value", value: "a" }],
          children: [{ kind: "text", text: "a" }],
          kind: "element",
          tag: "option",
        },
        {
          attrs: [{ kind: "static", name: "value", value: "b" }],
          children: [{ kind: "text", text: "b" }],
          kind: "element",
          tag: "option",
        },
      ],
      inline: true,
      kind: "element",
      tag: "select",
    },
  };
  expect(renderVueSfc(comp)).toContain(
    '<select v-model="draft.status"><option value="a">a</option><option value="b">b</option></select>',
  );
});

test("a default slot renders as <slot />", () => {
  const comp: Component = {
    name: "Box",
    view: { attrs: [], children: [{ children: [], kind: "slot" }], kind: "element", tag: "div" },
  };
  expect(renderVueSfc(comp)).toContain("    <slot />");
});

test("a named slot renders as <slot name=… />", () => {
  const comp: Component = { name: "Shell", view: { children: [], kind: "slot", name: "header" } };
  expect(renderVueSfc(comp)).toContain('  <slot name="header" />');
});

test("a slot with inline fallback renders open/close on one line", () => {
  const comp: Component = {
    name: "Empty",
    view: { children: [{ kind: "text", text: "Nothing here" }], kind: "slot" },
  };
  expect(renderVueSfc(comp)).toContain("  <slot>Nothing here</slot>");
});

test("a named slot with element fallback renders open/close over lines", () => {
  const comp: Component = {
    name: "Footer",
    view: {
      children: [{ attrs: [], children: [{ kind: "text", text: "x" }], kind: "element", tag: "p" }],
      kind: "slot",
      name: "footer",
    },
  };
  expect(renderVueSfc(comp)).toContain(
    ['  <slot name="footer">', "    <p>x</p>", "  </slot>"].join("\n"),
  );
});

test("props with defaults render via withDefaults(...)", () => {
  const comp: Component = {
    name: "Flex",
    props: [
      { default: "'row'", name: "direction", optional: true, tsType: "string" },
      { default: "0", name: "gap", optional: true, tsType: "number" },
    ],
    view: { attrs: [], children: [{ children: [], kind: "slot" }], kind: "element", tag: "div" },
  };
  expect(renderVueSfc(comp)).toContain(
    "const props = withDefaults(defineProps<{ direction?: string; gap?: number }>(), { direction: 'row', gap: 0 });",
  );
});

test("props without defaults still render as plain defineProps (byte-stable, no withDefaults)", () => {
  const comp: Component = {
    name: "Field",
    props: [{ name: "label", tsType: "string" }],
    view: { attrs: [], children: [], kind: "element", tag: "div" },
  };
  const sfc = renderVueSfc(comp);
  expect(sfc).toContain("const props = defineProps<{ label: string }>();");
  expect(sfc).not.toContain("withDefaults");
});

test("a bound attr name that would forge a directive is rejected (#305 injection)", () => {
  // The confirmed breakout: a `## view` prop key `class="x" @click` would render a real `@click` attr.
  // The renderer is the universal choke point — it rejects the name before any markup is produced.
  const comp: Component = {
    name: "Card",
    view: {
      attrs: [{ expr: "'doEvil()'", kind: "bound", name: 'class="x" @click' }],
      children: [],
      kind: "component",
      name: "Card",
    },
  };
  expect(() => renderVueSfc(comp)).toThrow(/not a safe attribute name/u);
});

test("a legitimate bound attr name still renders byte-stable (the guard is inert for valid input)", () => {
  const comp: Component = {
    name: "Field",
    view: {
      attrs: [{ expr: "label", kind: "bound", name: "aria-label" }],
      children: [],
      kind: "component",
      name: "Field",
    },
  };
  expect(renderVueSfc(comp)).toContain(`<Field :aria-label="label" />`);
});
