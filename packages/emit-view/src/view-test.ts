import { formScenarios, renderScenarios } from "./view-scenarios.ts";
import type { ReadonlyVow } from "./types.ts";
import { pascalCase } from "@vow/component";
import { viewComponentName } from "./naming.ts";

/** One render scenario, as `renderScenarios` yields it — the element type of its return. */
type RenderScenario = ReturnType<typeof renderScenarios>[number];

/**
 * The render + a11y test emitter — a Vitest suite (jsdom) that mounts a generated `.vue` via
 * `@vue/test-utils` and runs `axe` on it. The test names ARE the proven scenarios (`view-scenarios.ts`),
 * so the coverage gate covers them. Mirrors `@vow/emit-entity`'s `emitEntityTest`: the generated UI
 * proves itself. It asserts only that the component mounts and is accessible — not its intent.
 */

/** One generated `test(...)` block — its name is the scenario, its body the kind's check. */
function testBlock(label: string, scenario: RenderScenario): readonly string[] {
  if (scenario.kind === "a11y") {
    return [
      ``,
      `test(${JSON.stringify(scenario.claim)}, async () => {`,
      `  const wrapper = mount(${label}, { attachTo: document.body });`,
      `  const results = await axe.run(wrapper.element);`,
      `  expect(results.violations).toEqual([]);`,
      `  wrapper.unmount();`,
      `});`,
    ];
  }
  return [
    ``,
    `test(${JSON.stringify(scenario.claim)}, () => {`,
    `  const wrapper = mount(${label});`,
    `  expect(wrapper.exists()).toBe(true);`,
    `  wrapper.unmount();`,
    `});`,
  ];
}

/** A render + a11y Vitest suite mounting `./<componentFile>` as `<label>`, named after its scenarios. */
function emitRenderTest(componentFile: string, label: string, slug: string): string {
  const out: string[] = [
    `// @vitest-environment jsdom`,
    `import { expect, test } from "vite-plus/test";`,
    `import { mount } from "@vue/test-utils";`,
    `import axe from "axe-core";`,
    `import ${label} from "./${componentFile}";`,
    ``,
    `// Generated from vow "${slug}". Each test name IS a proven scenario — do not edit.`,
  ];
  for (const scenario of renderScenarios(label)) {
    out.push(...testBlock(label, scenario));
  }
  out.push(``);
  return out.join("\n");
}

/** The render + a11y test for a `## view` / `## form` page (`tasks` → mounts `./tasks.vue` as `Tasks`). */
export function emitViewTest(vow: ReadonlyVow): string {
  return emitRenderTest(`${vow.slug}.vue`, pascalCase(vow.slug), vow.slug);
}

/** The render + a11y test for an entity's list composition (`task` → mounts `./Task.vue` as `Task`). */
export function emitCompositionTest(entity: ReadonlyVow): string {
  const name = viewComponentName(entity);
  return emitRenderTest(`${name}.vue`, name, entity.slug);
}

/** A form-interaction Vitest suite: mount the form, submit it empty, assert validation surfaces an error
    (the `role="alert"` per-field error). Names the test after the proven scenario. */
export function emitFormTest(vow: ReadonlyVow, hasRequired: boolean): string {
  const label = pascalCase(vow.slug);
  const out: string[] = [
    `// @vitest-environment jsdom`,
    `import { expect, test } from "vite-plus/test";`,
    `import { mount } from "@vue/test-utils";`,
    `import ${label} from "./${vow.slug}.vue";`,
    ``,
    `// Generated from vow "${vow.slug}". Each test name IS a proven scenario — do not edit.`,
  ];
  for (const scenario of formScenarios(label, hasRequired)) {
    out.push(
      ``,
      `test(${JSON.stringify(scenario.claim)}, async () => {`,
      `  const wrapper = mount(${label});`,
      `  await wrapper.find("form").trigger("submit");`,
      `  expect(wrapper.find('[role="alert"]').exists()).toBe(true);`,
      `  wrapper.unmount();`,
      `});`,
    );
  }
  out.push(``);
  return out.join("\n");
}
