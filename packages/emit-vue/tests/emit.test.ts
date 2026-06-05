import { expect, test } from "vite-plus/test";
import { type Vow as VowNode } from "@vow/core";
import { emitVueModule, emitVueSfc } from "../src/index.ts";

const emitVow: VowNode = {
  id: "vow_card",
  slug: "welcome-card",
  intent: "Welcome to vow",
  children: [],
  proof: [],
  fulfills: { kind: "emit", as: "vue" },
};
const bindVow: VowNode = {
  id: "vow_b",
  slug: "rollup",
  intent: "Status roll-up",
  children: [],
  proof: [],
  fulfills: { kind: "bind", module: "@vow/core", export: "rollup" },
};

test("emitVueModule produces a runnable Vue component (defineComponent + render)", () => {
  const mod = emitVueModule(emitVow);
  expect(mod).toContain('import { defineComponent, h } from "vue"');
  expect(mod).toContain('name: "WelcomeCard"'); // slug → PascalCase
  expect(mod).toContain("Welcome to vow"); // the vow's intent, rendered
});

test("emitVueSfc produces a readable SFC for eject (script setup + template)", () => {
  const sfc = emitVueSfc(emitVow);
  expect(sfc).toContain('<script setup lang="ts">');
  expect(sfc).toContain("<template>");
  expect(sfc).toContain("Welcome to vow");
});

test("both emitters fail fast on a non-emit vow", () => {
  expect(() => emitVueModule(bindVow)).toThrow();
  expect(() => emitVueSfc(bindVow)).toThrow();
});

test("the SFC HTML-escapes the intent", () => {
  expect(emitVueSfc({ ...emitVow, intent: "render <b> & such" })).toContain(
    "render &lt;b&gt; &amp; such",
  );
});
