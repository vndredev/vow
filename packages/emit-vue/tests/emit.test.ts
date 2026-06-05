import { expect, test } from "vite-plus/test";
import { type Vow as VowNode } from "@vow/core";
import { emitVueSfc } from "../src/index.ts";

const emitVow: VowNode = {
  id: "vow_card",
  slug: "welcome-card",
  intent: "Welcome to vow",
  children: [],
  proof: [],
  fulfills: { kind: "emit", as: "vue" },
};

test("an emit vow becomes a real Vue SFC (script setup + template)", () => {
  const sfc = emitVueSfc(emitVow);
  expect(sfc).toContain('<script setup lang="ts">');
  expect(sfc).toContain("<template>");
  expect(sfc).toContain("Welcome to vow"); // the vow's intent is rendered
  expect(sfc).toContain('name: "WelcomeCard"'); // slug → PascalCase component name
});

test("emitting a non-emit vow fails fast", () => {
  const bindVow: VowNode = {
    id: "vow_b",
    slug: "rollup",
    intent: "Status roll-up",
    children: [],
    proof: [],
    fulfills: { kind: "bind", module: "@vow/core", export: "rollup" },
  };
  expect(() => emitVueSfc(bindVow)).toThrow();
});

test("the intent is HTML-escaped into the template", () => {
  const sfc = emitVueSfc({ ...emitVow, intent: "render <b> & such" });
  expect(sfc).toContain("render &lt;b&gt; &amp; such");
});
