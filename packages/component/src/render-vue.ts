import type { Component } from "./model.ts";
import { renderNode } from "./render-node.ts";
import { renderScript } from "./render-script.ts";

/**
 * The Vue adapter — render a canonical `Component` into a Vue SFC string. The first of many adapters
 * (React/Solid later render the same model differently). Output is **byte-stable**: pinned by an
 * equality test against the hand-written emitter output, so a render change is a red test, not a
 * silent drift.
 */
export function renderVueSfc(component: Component): string {
  return [
    `<script setup lang="ts">`,
    ...renderScript(component),
    `</script>`,
    ``,
    `<template>`,
    renderNode(component.view, 1),
    `</template>`,
    ``,
  ].join("\n");
}
